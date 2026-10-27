//文字コードはutf-8

/* ハンバーガーメニュー
========================================================*/
import { MEDIA_QUERIES } from '../utils/breakpoints.js';

export function initHamburgerMenu() {
    const menu = document.querySelectorAll('.header__list');
    const openBtn = document.querySelectorAll('.openbtn');
    const mq = window.matchMedia(MEDIA_QUERIES.smartphone);

    // ページが読み込まれた時に実行
    handle(mq);

    function handle(mm) {
        $(function () {
            $(openBtn).off('click.hamburger').on('click.hamburger', function () {
                if ($(openBtn).hasClass('active')) {
                    $(openBtn).removeClass('active');
                    $(menu).slideUp();
                } else {
                    $(openBtn).toggleClass('active');
                    $(menu).slideDown();
                }
            });
            if (mm.matches) {
                $(menu).hide();
            }
            // メディアクエリ変化時
            if (mm.addEventListener) {
                mm.addEventListener('change', mqHandler);
            } else {
                mm.addListener(mqHandler);
            }
            function mqHandler(m) {
                if (m.matches) {
                    $(menu).hide();
                } else {
                    $(menu).show();
                    $(openBtn).removeClass('active');
                }
            }
        });
    }
}
