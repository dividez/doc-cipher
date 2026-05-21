import { z } from 'zod';

export const regexRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal('regex'),
  enabled: z.boolean(),
  pattern: z.string().min(1),
  placeholder: z.string().min(1),
});

export const keywordRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal('keyword'),
  enabled: z.boolean(),
  keywords: z.array(z.string().min(1)),
  placeholder: z.string().min(1),
});

export const manualRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal('manual'),
  enabled: z.boolean(),
  selections: z.array(z.string().min(1)).default([]),
  placeholder: z.string().min(1),
});

export const maskingRuleSchema = z.discriminatedUnion('type', [
  regexRuleSchema,
  keywordRuleSchema,
  manualRuleSchema,
]);

export const aiAssistSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  confidence_threshold: z.number().min(0).max(1).default(0.75),
});

export const appSettingsSchema = z.object({
  enable_regex_rules: z.boolean().default(true),
  enable_system_keywords: z.boolean().default(true),
  default_output_dir: z.string().default(''),
  ai_assist: aiAssistSettingsSchema.default({
    enabled: false,
    confidence_threshold: 0.75,
  }),
});

export const settingsSchema = z.object({
  version: z.string().min(1),
  app: appSettingsSchema,
  masking: z.object({
    placeholder_style: z.enum(['typed_counter']).default('typed_counter'),
    default_mask_char: z.string().min(1).default('*'),
  }),
  rules: z.array(maskingRuleSchema),
});

export type RegexRule = z.infer<typeof regexRuleSchema>;
export type KeywordRule = z.infer<typeof keywordRuleSchema>;
export type ManualRule = z.infer<typeof manualRuleSchema>;
export type MaskingRule = z.infer<typeof maskingRuleSchema>;
export type AiAssistSettings = z.infer<typeof aiAssistSettingsSchema>;
export type AppSettingsConfig = z.infer<typeof appSettingsSchema>;
export type Settings = z.infer<typeof settingsSchema>;

export const defaultSettings: Settings = {
  version: '1.0.0',
  app: {
    enable_regex_rules: true,
    enable_system_keywords: true,
    default_output_dir: '',
    ai_assist: {
      enabled: false,
      confidence_threshold: 0.75,
    },
  },
  masking: {
    placeholder_style: 'typed_counter',
    default_mask_char: '*',
  },
  rules: [
    {
      id: 'phone',
      name: '手机号',
      type: 'regex',
      enabled: true,
      pattern: '(?<!\\d)1[3-9]\\d{9}(?!\\d)',
      placeholder: '[PHONE_{n}]',
    },
    {
      id: 'id_card',
      name: '身份证号',
      type: 'regex',
      enabled: true,
      pattern: '\\b\\d{17}[\\dXx]\\b',
      placeholder: '[ID_CARD_{n}]',
    },
    {
      id: 'keywords',
      name: '关键词',
      type: 'keyword',
      enabled: true,
      keywords: ['张三', '某某公司'],
      placeholder: '[KEYWORD_{n}]',
    },
    {
      id: 'ai_sensitive',
      name: 'AI 敏感实体',
      type: 'keyword',
      enabled: false,
      keywords: [],
      placeholder: '[AI_{n}]',
    },
  ],
};
