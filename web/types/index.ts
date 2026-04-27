// Общие типы для веб-лендинга. Зеркалят будущий backend-контракт (FastAPI / Pydantic).

export type ISODate = string; // YYYY-MM-DD

export type NumerologyContext = {
  lifePath: number;       // master numbers 11/22/33 сохраняются
  personalYear: number;   // 1–9
  personalMonth: number;  // 1–9
  personalDay: number;    // 1–9
};

export type FrictionZone =
  | "timing_mismatch"
  | "phase_mismatch"
  | "energy_mismatch"
  | "depth_mismatch"
  | "rhythm_match"
  | "complementary_pair";

export type PairContext = {
  user: NumerologyContext;
  partner: NumerologyContext;
  pairCycle: string;
  friction: FrictionZone;
  date: ISODate;
};

export type Observation = {
  /** «динамика», «трение» или «сила» — для рендеринга карточек */
  kind: "dynamic" | "friction" | "strength";
  text: string;
};

export type SessionPayload = {
  token: string;
  birthDateUser: ISODate;
  birthDatePartner: ISODate;
  observations: Observation[];
  context: PairContext;
  createdAt: string;       // ISO datetime
  expiresAt: string;       // ISO datetime, через 7 дней
};
