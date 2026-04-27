"""SQLAlchemy 2.0 модели по PRD §9.1.

Полный набор сущностей v1 определён сразу — Android и Web будут наполнять
их CRUD-эндпойнтами по мере появления функциональности. Это соответствует
архитектурному решению PRD §9.1 «Schema БД готова к расширению».

Принципы:
— UUID PK через `Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4)`,
  чтобы id были clipboard-friendly и предсказуемы для интеграционных тестов.
— Soft delete через `deleted_at` для User/Profile (PRD §15).
— Все timestamps в UTC.
"""

from __future__ import annotations

import enum
import typing
import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _utc_now() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    """Общая база с автоматическими created_at/updated_at."""

    # JSONB на Postgres, JSON на SQLite (для тестов).
    # ClassVar — это API SQLAlchemy (mapping типов → SQL-типы), не bug-prone default.
    type_annotation_map: typing.ClassVar = {
        dict: JSON().with_variant(JSONB(), "postgresql"),
    }


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, onupdate=_utc_now, nullable=False
    )


# === Перечисления (PRD §9.1) ===


class AuthProvider(enum.StrEnum):
    google = "google"
    yandex = "yandex"
    magic_link = "magic_link"


class SubscriptionTier(enum.StrEnum):
    free = "free"
    solo = "solo"
    duo = "duo"
    family = "family"  # v1.5


class SubscriptionStatus(enum.StrEnum):
    none = "none"
    trial = "trial"
    active = "active"
    cancelled = "cancelled"
    grace = "grace"


class SubscriptionSource(enum.StrEnum):
    rustore = "rustore"
    yookassa = "yookassa"
    sbp = "sbp"
    appgallery = "appgallery"
    google_play = "google_play"


class PlatformKind(enum.StrEnum):
    android = "android"
    web_only = "web_only"


class ProfileType(enum.StrEnum):
    own = "own"
    tracked = "tracked"  # партнёр без согласия, по дате рождения (PRD §3.3)
    linked = "linked"  # оба подтвердили связь


class RelationshipType(enum.StrEnum):
    romantic_partner = "romantic_partner"
    close_person = "close_person"
    # v1.5: child, parent, friend, colleague


class PairLinkStatus(enum.StrEnum):
    active = "active"
    separated = "separated"


class MomentCategory(enum.StrEnum):
    conversation = "conversation"
    decision = "decision"
    conflict = "conflict"
    agreement = "agreement"
    surprise = "surprise"
    observation = "observation"


class MomentSource(enum.StrEnum):
    app = "app"
    quick_tile = "quick_tile"
    widget = "widget"


class UserReaction(enum.StrEnum):
    """1-tap реакция на AI-ответ (PRD §14.4)."""

    positive = "positive"  # 🎯 точно про меня
    neutral = "neutral"  # 🤔 интересно
    negative = "negative"  # 👎 мимо


class GenerationType(enum.StrEnum):
    morning_prompt = "morning_prompt"
    evening_insight = "evening_insight"
    pattern_report = "pattern_report"
    wow_screen = "wow_screen"


class DeviceType(enum.StrEnum):
    android = "android"
    web = "web"
    ios = "ios"  # для будущего, чтобы схема не ломалась


class PushProvider(enum.StrEnum):
    fcm = "fcm"
    hms = "hms"
    web_push = "web_push"


# === Таблицы ===


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320), unique=True, index=True)
    auth_provider: Mapped[AuthProvider] = mapped_column(
        Enum(AuthProvider, native_enum=False, length=32), nullable=False
    )
    provider_user_id: Mapped[str | None] = mapped_column(String(255), index=True)

    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    subscription_tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier, native_enum=False, length=16),
        default=SubscriptionTier.free,
        nullable=False,
    )
    subscription_status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus, native_enum=False, length=16),
        default=SubscriptionStatus.none,
        nullable=False,
    )
    subscription_source: Mapped[SubscriptionSource | None] = mapped_column(
        Enum(SubscriptionSource, native_enum=False, length=32)
    )

    timezone: Mapped[str] = mapped_column(String(64), default="Europe/Moscow", nullable=False)
    language: Mapped[str] = mapped_column(String(8), default="ru", nullable=False)
    primary_platform: Mapped[PlatformKind] = mapped_column(
        Enum(PlatformKind, native_enum=False, length=16),
        default=PlatformKind.web_only,
        nullable=False,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    profiles: Mapped[list[Profile]] = relationship(
        back_populates="owner", foreign_keys="Profile.owner_user_id"
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class AnonymousSession(Base):
    """Сессия wow-экрана: две даты + сгенерированный мини-разбор.

    Живёт 7 дней (Redis в проде, ниже в БД для долговременной аналитики).
    После регистрации пользователя поглощается в User-аккаунт однократно
    (PRD §9.2).
    """

    __tablename__ = "anonymous_sessions"

    token: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    birth_date_user: Mapped[Date] = mapped_column(Date, nullable=False)
    birth_date_partner: Mapped[Date] = mapped_column(Date, nullable=False)

    # Полный JSON ответа /session — отдаётся обратно при /session/{token} GET.
    pair_mini_analysis: Mapped[dict] = mapped_column(JSON, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    converted_to_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    platform_install: Mapped[str | None] = mapped_column(String(32))


class Profile(Base, TimestampMixin):
    """Профиль человека: own / tracked / linked (PRD §7.2)."""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    type: Mapped[ProfileType] = mapped_column(
        Enum(ProfileType, native_enum=False, length=16), nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(120))
    birth_date: Mapped[Date] = mapped_column(Date, nullable=False)
    birth_time: Mapped[str | None] = mapped_column(String(8))  # "HH:MM"
    birth_location: Mapped[str | None] = mapped_column(String(255))

    relationship_type: Mapped[RelationshipType] = mapped_column(
        Enum(RelationshipType, native_enum=False, length=32),
        default=RelationshipType.romantic_partner,
        nullable=False,
    )

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    owner: Mapped[User] = relationship(back_populates="profiles", foreign_keys=[owner_user_id])

    __table_args__ = (
        # У одного пользователя ровно один own-профиль (PRD §9.2).
        Index(
            "ix_profiles_one_own_per_user",
            "owner_user_id",
            unique=True,
            postgresql_where=(type == ProfileType.own),
        ),
    )


class PairLink(Base, TimestampMixin):
    """Связь между двумя профилями. PRD §6.3 / §9.2."""

    __tablename__ = "pair_links"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    profile_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    profile_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("profiles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[PairLinkStatus] = mapped_column(
        Enum(PairLinkStatus, native_enum=False, length=16),
        default=PairLinkStatus.active,
        nullable=False,
    )
    linked_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False
    )
    separated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    pair_share_token: Mapped[str | None] = mapped_column(String(64), unique=True, index=True)
    snapshot_reason: Mapped[str | None] = mapped_column(String(255))

    __table_args__ = (
        UniqueConstraint("profile_a_id", "profile_b_id", name="uq_pair_links_profiles"),
    )


class Reflection(Base):
    """Запись рефлексии: prompt → user_input → ai_response (PRD §7.5, §9.1)."""

    __tablename__ = "reflections"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pair_link_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pair_links.id", ondelete="SET NULL"), index=True
    )

    date: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    prompt_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("prompts.id", ondelete="SET NULL")
    )
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    user_input: Mapped[str | None] = mapped_column(Text)
    ai_response: Mapped[str | None] = mapped_column(Text)
    ai_model_used: Mapped[str | None] = mapped_column(String(64))

    # Снимок нумерологии и контекста дня — для воспроизводимости и анализа.
    context_snapshot: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False
    )
    user_reaction: Mapped[UserReaction | None] = mapped_column(
        Enum(UserReaction, native_enum=False, length=16)
    )


class MomentTag(Base):
    """Короткая пометка в течение дня (PRD §7.8)."""

    __tablename__ = "moment_tags"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pair_link_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pair_links.id", ondelete="SET NULL")
    )
    related_profile_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("profiles.id", ondelete="SET NULL")
    )

    category: Mapped[MomentCategory] = mapped_column(
        Enum(MomentCategory, native_enum=False, length=24), nullable=False
    )
    description: Mapped[str | None] = mapped_column(String(120))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False, index=True
    )
    source: Mapped[MomentSource] = mapped_column(
        Enum(MomentSource, native_enum=False, length=16),
        default=MomentSource.app,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False
    )


class PatternReport(Base):
    """Узор недели — еженедельный отчёт (PRD §7.6)."""

    __tablename__ = "pattern_reports"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pair_link_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pair_links.id", ondelete="SET NULL")
    )

    week_start: Mapped[Date] = mapped_column(Date, nullable=False, index=True)
    week_end: Mapped[Date] = mapped_column(Date, nullable=False)
    reflections_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    moment_tags_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    patterns: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    ai_narrative: Mapped[str | None] = mapped_column(Text)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False
    )
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Prompt(Base, TimestampMixin):
    """Admin-managed library of prompts (PRD §10.6)."""

    __tablename__ = "prompts"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    template: Mapped[str] = mapped_column(Text, nullable=False)
    context_rules: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    category: Mapped[str] = mapped_column(String(64), nullable=False)
    tone_variant: Mapped[str | None] = mapped_column(String(64))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    ab_group: Mapped[str | None] = mapped_column(String(32))


class Subscription(Base, TimestampMixin):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tier: Mapped[SubscriptionTier] = mapped_column(
        Enum(SubscriptionTier, native_enum=False, length=16), nullable=False
    )
    billing_period: Mapped[str] = mapped_column(String(16), nullable=False)  # monthly | yearly
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_period_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payment_provider: Mapped[SubscriptionSource] = mapped_column(
        Enum(SubscriptionSource, native_enum=False, length=32), nullable=False
    )
    provider_subscription_id: Mapped[str | None] = mapped_column(String(255), index=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DeviceRegistration(Base, TimestampMixin):
    """Регистрация push-устройства (PRD §13.5)."""

    __tablename__ = "device_registrations"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    device_type: Mapped[DeviceType] = mapped_column(
        Enum(DeviceType, native_enum=False, length=16), nullable=False
    )
    push_token: Mapped[str] = mapped_column(String(512), nullable=False)
    push_provider: Mapped[PushProvider] = mapped_column(
        Enum(PushProvider, native_enum=False, length=16), nullable=False
    )
    device_model: Mapped[str | None] = mapped_column(String(120))
    os_version: Mapped[str | None] = mapped_column(String(32))
    app_version: Mapped[str | None] = mapped_column(String(32))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class Event(Base):
    """Сырой лог аналитических событий (PRD §14.1)."""

    __tablename__ = "events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    anonymous_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("anonymous_sessions.token", ondelete="SET NULL"), index=True
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    platform: Mapped[str] = mapped_column(String(16), nullable=False)
    properties: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False, index=True
    )


class AIGenerationLog(Base):
    """Расширенный лог LLM-вызовов для будущей калибровки Knowledge Layer
    (PRD §10.7 + §14.6).

    Каждый AI-вызов пишется со всем контекстом и реакцией пользователя.
    К месяцу 4 при 1000 платящих ожидается ≥10 000 записей — это
    calibration dataset для v1.5.
    """

    __tablename__ = "ai_generation_log"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    reflection_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reflections.id", ondelete="SET NULL")
    )
    pattern_report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("pattern_reports.id", ondelete="SET NULL")
    )
    anonymous_session_token: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("anonymous_sessions.token", ondelete="SET NULL")
    )

    generation_type: Mapped[GenerationType] = mapped_column(
        Enum(GenerationType, native_enum=False, length=32), nullable=False, index=True
    )
    system_prompt_version: Mapped[str | None] = mapped_column(String(32))
    input_context: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    output_text: Mapped[str | None] = mapped_column(Text)
    llm_model: Mapped[str | None] = mapped_column(String(64))
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    cache_read_input_tokens: Mapped[int | None] = mapped_column(Integer)
    cache_creation_input_tokens: Mapped[int | None] = mapped_column(Integer)

    # Источник: claude | template_primary | template_fallback
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)

    user_reaction: Mapped[UserReaction | None] = mapped_column(
        Enum(UserReaction, native_enum=False, length=16)
    )
    reaction_comment: Mapped[str | None] = mapped_column(Text)
    reaction_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False, index=True
    )


class ReflectionTopic(Base):
    """Sentiment / topic analysis для будущего Knowledge Layer (PRD §9.1)."""

    __tablename__ = "reflection_topics"

    id: Mapped[uuid.UUID] = mapped_column(default=uuid.uuid4, primary_key=True)
    reflection_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("reflections.id", ondelete="CASCADE"), nullable=False, index=True
    )
    topic_tags: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)
    sentiment: Mapped[str | None] = mapped_column(String(16))  # positive | neutral | negative | mixed
    intensity: Mapped[int | None] = mapped_column(Integer)  # 1–10
    extracted_concepts: Mapped[dict] = mapped_column(JSON, default=list, nullable=False)
    analyzed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utc_now, nullable=False
    )
