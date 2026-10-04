import { z } from "zod";
import { APPLICATION_STATUSES } from "@/db/schema/enums";
import { cleanText } from "./fields";

const message = (max: number, label = "Message") =>
  z
    .string()
    .transform(cleanText)
    .pipe(z.string().min(1, { error: `${label} is required` }).max(max, { error: `${label} must be ${max} characters or fewer` }));

const optionalMessage = (max: number) =>
  z
    .string()
    .transform(cleanText)
    .pipe(z.string().max(max))
    .optional()
    .transform((v) => (v ? v : undefined));

const id = z.uuid();

export const changeStatusSchema = z.object({
  applicationId: id,
  status: z.enum(APPLICATION_STATUSES),
  notify: z.boolean().default(true),
});

export const requestInfoSchema = z.object({
  applicationId: id,
  items: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,40}$/)).max(10),
  message: message(2000),
});

export const eligibilitySchema = z.object({
  applicationId: id,
  eligible: z.boolean(),
  message: optionalMessage(2000),
  notify: z.boolean().default(true),
});

export const accountRequestSchema = z.object({
  applicationId: id,
  message: optionalMessage(2000),
});

export const customMessageSchema = z.object({
  applicationId: id,
  subject: message(150, "Subject"),
  message: message(5000),
});

export const noteSchema = z.object({
  applicationId: id,
  body: message(5000, "Note"),
});

export const applicationIdSchema = z.object({ applicationId: id });
