//文字コードはutf-8

// ブレークポイントの数値を定義（_variables.scssと同期）
export const BREAKPOINTS = {
    pc_min: 769,
    tablet_max: 1000,
    tablet_min: 1001,
    smartphone_max: 768,
    base_content_width: 960
};

// SCSSの$breakpointsと同じキー・値で定義
export const MEDIA_QUERIES = {
    smartphone: `screen and (max-width: ${BREAKPOINTS.smartphone_max}px)`,
    tablet: `screen and (min-width: ${BREAKPOINTS.tablet_min}px) and (max-width: ${BREAKPOINTS.tablet_max}px)`,
    pc_x_tablet: `screen and (min-width: ${BREAKPOINTS.tablet_min}px)`,
    sp_x_tablet: `screen and (max-width: ${BREAKPOINTS.tablet_max}px)`,
    pc_content_size: `screen and (min-width: ${BREAKPOINTS.pc_min}px) and (max-width: ${BREAKPOINTS.base_content_width}px)`,
    pc: `screen and (min-width: ${BREAKPOINTS.pc_min}px)`
};
