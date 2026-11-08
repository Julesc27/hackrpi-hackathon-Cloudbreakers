"""Regression tests for the asynchronous deploy protocol."""

import http.client
import importlib.util
import json
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("deploy_hook", Path(__file__).with_name("hook.py"))
assert spec is not None and spec.loader is not None
hook = importlib.util.module_from_spec(spec)
spec.loader.exec_module(hook)


class DeployClaimsTests(unittest.TestCase):
    def setUp(self):
        hook._seen_jti.clear()

    def verify_claims(self, event="push", **overrides):
        ref = f"refs/heads/{hook.CONFIG['branch']}"
        claims = {
            "repository_id": hook.CONFIG["repository_id"],
            "ref": ref,
            "ref_type": "branch",
            "workflow_ref": f"owner/repo/{hook.CONFIG['workflow_file']}@{ref}",
            "event_name": event,
            "runner_environment": "github-hosted",
            "sha": "a" * 40,
            "jti": "one-use-token",
            "exp": time.time() + 60,
        }
        claims.update(overrides)
        with patch.object(hook.jwt, "get_unverified_header", return_value={"alg": "RS256", "kid": "test"}), \
             patch.object(hook._jwks, "get", return_value="test-key"), \
             patch.object(hook.jwt, "decode", return_value=claims):
            return hook.verify("test-token")

    def test_main_push_and_manual_dispatch_can_deploy(self):
        for event in ("push", "workflow_dispatch"):
            with self.subTest(event=event):
                hook._seen_jti.clear()
                self.assertEqual(self.verify_claims(event)["event_name"], event)

    def test_other_events_and_refs_cannot_deploy(self):
        for event, overrides in (
            ("pull_request", {}),
            ("push", {"ref": "refs/heads/feature"}),
            ("push", {"workflow_ref": "owner/repo/.github/workflows/ci.yml@refs/heads/main"}),
        ):
            with self.subTest(event=event, overrides=overrides):
                hook._seen_jti.clear()
                with self.assertRaisesRegex(hook.HookError, "token not allowed to deploy"):
                    self.verify_claims(event, **overrides)


class DeployProtocolTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state_file = str(Path(self.temp.name) / "jobs.json")
        state = patch.object(hook, "STATE_FILE", self.state_file)
        state.start()
        self.addCleanup(state.stop)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), hook.Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)

    def request(self, method, path, headers=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        conn.request(method, path, headers=headers or {})
        response = conn.getresponse()
        result = response.status, json.loads(response.read())
        conn.close()
        return result

    def test_post_returns_job_and_status_survives_reload(self):
        sha = "a" * 40
        finished = threading.Event()

        def deploy(_sha):
            self.assertEqual(_sha, sha)
            finished.wait(3)
            return {"status": "deployed", "to": sha[:7]}

        with patch.object(hook, "verify", return_value={"sha": sha, "actor": "tester"}), patch.object(hook, "deploy", side_effect=deploy):
            status, start = self.request("POST", "/hook", {"Authorization": "Bearer test"})
            self.assertEqual(status, 202)
            self.assertEqual(self.request("GET", start["status_url"])[0], 200)
            finished.set()
            job = {}
            for _ in range(100):
                job = hook._load_jobs().get(start["job"], {})
                if job.get("status") == "deployed":
                    break
                threading.Event().wait(0.01)
            self.assertEqual(job["status"], "deployed")
            self.assertEqual(self.request("GET", start["status_url"])[1]["to"], sha[:7])

    def test_job_reports_failure_if_running_state_cannot_be_saved(self):
        original = hook._save_job
        attempts = []

        def flaky(job_id, job):
            attempts.append(job["status"])
            if len(attempts) == 1:
                raise OSError("temporary state failure")
            return original(job_id, job)

        with patch.object(hook, "_save_job", side_effect=flaky), patch.object(hook, "deploy", return_value={"status": "deployed"}):
            hook._run_job("job", "a" * 40, "tester")
        self.assertEqual(hook._load_jobs()["job"]["status"], "failed")
        self.assertIn("temporary state failure", hook._load_jobs()["job"]["error"])


if __name__ == "__main__":
    unittest.main()
