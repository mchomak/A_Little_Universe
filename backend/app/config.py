import os

from pydantic import BaseModel, Field


class Settings(BaseModel):
    app_name: str = Field(default="A Little Universe API", min_length=1, max_length=100)
    debug: bool = False

    @classmethod
    def from_environment(cls) -> "Settings":
        values = {
            "app_name": os.environ.get("ALU_APP_NAME", "A Little Universe API"),
            "debug": os.environ.get("ALU_DEBUG", "false"),
        }
        return cls.model_validate(values)
