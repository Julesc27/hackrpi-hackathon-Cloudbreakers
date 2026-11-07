from app.models.player import Player, PlayerOut
from app.models.town import TownSave

# Every Beanie Document must be listed here so init_beanie registers it.
DOCUMENT_MODELS = [Player]

__all__ = ["DOCUMENT_MODELS", "Player", "PlayerOut", "TownSave"]
