import { z } from "zod";

/**
 * Дата рождения принимается в формате YYYY-MM-DD. Валидируем по календарю,
 * чтобы 31-го февраля не уходило в нумерологический движок.
 *
 * Дополнительно — диапазон правдоподобия: после 1900-01-01 и не позже текущего дня.
 * Возрастных ограничений на лендинге не вводим: нумерологический разбор
 * не делает выводов о пользователе как о ребёнке/взрослом.
 */
export const birthDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате ГГГГ-ММ-ДД")
  .refine((value) => {
    const d = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return false;
    if (d.toISOString().slice(0, 10) !== value) return false;
    const lower = new Date("1900-01-01T00:00:00Z").getTime();
    if (d.getTime() < lower) return false;
    if (d.getTime() > Date.now()) return false;
    return true;
  }, "Эта дата не выглядит правдоподобной");

export const sessionRequestSchema = z.object({
  birthDateUser: birthDateSchema,
  birthDatePartner: birthDateSchema,
});

export type SessionRequest = z.infer<typeof sessionRequestSchema>;

export const waitlistRequestSchema = z.object({
  email: z.string().email("Неверный email"),
});

export type WaitlistRequest = z.infer<typeof waitlistRequestSchema>;
