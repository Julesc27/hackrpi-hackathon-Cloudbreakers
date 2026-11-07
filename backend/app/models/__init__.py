from app.models.player import Player, PlayerOut, PlayerUpdate

# Every Beanie Document must be listed here so init_beanie registers it.
DOCUMENT_MODELS = [Player]

__all__ = ["DOCUMENT_MODELS", "Player", "PlayerOut", "PlayerUpdate"]
