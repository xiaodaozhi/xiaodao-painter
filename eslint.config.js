import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

export default [
  // 全局忽略
  {
    ignores: ['dist/**', 'node_modules/**'],
  },

  // JS 推荐规则
  js.configs.recommended,

  // TS 推荐规则（宽松，不强制类型相关规则）
  ...tseslint.configs.recommended,

  // Vue 推荐规则
  ...vue.configs['flat/recommended'],

  // 所有源文件：声明浏览器 + ES globals
  {
    files: ['**/*.{js,ts,vue}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
  },

  // Vue + TS 文件：用 vue-eslint-parser 解析
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        sourceType: 'module',
      },
    },
  },

  // TS 文件
  {
    files: ['**/*.ts'],
    languageOptions: {
      sourceType: 'module',
    },
  },

  // 项目自定义规则
  {
    rules: {
      // 代码风格 — 不强制，交给 Prettier 或个人偏好
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
]
