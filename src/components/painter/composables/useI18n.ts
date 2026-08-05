import { inject, provide } from 'vue';
import type { Locale } from '../utils/i18n';
import { t as _t } from '../utils/i18n';

export const I18N_KEY = Symbol('wb-locale') as unknown as string;
export const THEME_KEY = Symbol('wb-theme') as unknown as string;

export function provideLocale(locale: Locale) {
  provide(I18N_KEY, locale);
}

export function useI18n() {
  const locale = inject<Locale>(I18N_KEY, 'zh-CN');
  const t = (key: string) => _t(locale, key);
  return { locale, t };
}

export function provideTheme(theme: 'light' | 'dark') {
  provide(THEME_KEY, theme);
}

export function useTheme(): 'light' | 'dark' {
  return inject<'light' | 'dark'>(THEME_KEY, 'light');
}

export const ROOT_EL_KEY = Symbol('wb-root-el');

export function provideRootEl(el: Readonly<import('vue').Ref<HTMLElement | null>>) {
  provide(ROOT_EL_KEY, el);
}

export function useRootEl(): import('vue').Ref<HTMLElement | null> | null {
  return inject<import('vue').Ref<HTMLElement | null> | null>(ROOT_EL_KEY, null);
}
