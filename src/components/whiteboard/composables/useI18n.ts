import { inject, provide } from 'vue';
import type { Locale } from '../utils/i18n';
import { t as _t } from '../utils/i18n';

export const I18N_KEY = Symbol('wb-locale') as unknown as string;

export function provideLocale(locale: Locale) {
  provide(I18N_KEY, locale);
}

export function useI18n() {
  const locale = inject<Locale>(I18N_KEY, 'zh-CN');
  const t = (key: string) => _t(locale, key);
  return { locale, t };
}
