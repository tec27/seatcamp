import { css } from 'lit'

export const RESET = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
`

export const SHADOW_1 = css`
  box-shadow: 0 3px 1px -2px rgba(0, 0, 0, 0.14), 0 2px 2px 0 rgba(0, 0, 0, 0.098),
    0 1px 5px 0 rgba(0, 0, 0, 0.084);
`

export const SHADOW_2 = css`
  box-shadow: 0 2px 4px -1px rgba(0, 0, 0, 0.14), 0 4px 5px 0 rgba(0, 0, 0, 0.098),
    0 1px 10px 0 rgba(0, 0, 0, 0.084);
`

export const SHADOW_5 = css`
  box-shadow: 0 8px 10px -5px rgba(0, 0, 0, 0.14), 0 16px 24px 2px rgba(0, 0, 0, 0.098),
    0 6px 30px 5px rgba(0, 0, 0, 0.084);
`
