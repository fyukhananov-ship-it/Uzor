"""Pydantic v2 схемы для API.

Минимальный набор для текущих эндпойнтов: anonymous session + auth.
Будет расширяться по мере добавления роутеров (profiles, reflections, etc).
"""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# === Session (anonymous wow-screen) ===


class SessionCreateIn(BaseModel):
    birth_date_user: date = Field(alias="birthDateUser")
    birth_date_partner: date = Field(alias="birthDatePartner")

    model_config = ConfigDict(populate_by_name=True)


class NumerologyOut(BaseModel):
    life_path: int = Field(alias="lifePath")
    personal_year: int = Field(alias="personalYear")
    personal_month: int = Field(alias="personalMonth")
    personal_day: int = Field(alias="personalDay")

    model_config = ConfigDict(populate_by_name=True)


class PairContextOut(BaseModel):
    user: NumerologyOut
    partner: NumerologyOut
    pair_cycle: str = Field(alias="pairCycle")
    friction: str
    date: str

    model_config = ConfigDict(populate_by_name=True)


class ObservationOut(BaseModel):
    kind: Literal["dynamic", "friction", "strength"]
    text: str


class SessionOut(BaseModel):
    token: uuid.UUID
    birth_date_user: date = Field(alias="birthDateUser")
    birth_date_partner: date = Field(alias="birthDatePartner")
    observations: list[ObservationOut]
    context: PairContextOut
    created_at: datetime = Field(alias="createdAt")
    expires_at: datetime = Field(alias="expiresAt")

    model_config = ConfigDict(populate_by_name=True)


# === Auth ===


class MagicLinkRequestIn(BaseModel):
    email: EmailStr


class MagicLinkRequestOut(BaseModel):
    sent: bool = True
    # В dev возвращаем сам токен в payload — чтобы можно было пройти flow
    # без поднятого email-провайдера. В production это поле исчезает.
    dev_token: str | None = None


class MagicLinkVerifyIn(BaseModel):
    token: str


class RefreshIn(BaseModel):
    refresh: str


class TokenPair(BaseModel):
    access: str
    refresh: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str | None
    auth_provider: str
    subscription_tier: str
    subscription_status: str
    timezone: str
    language: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuthOut(BaseModel):
    access: str
    refresh: str
    user: UserOut
