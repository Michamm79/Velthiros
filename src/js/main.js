/* Velthiros - bootstrap */
(function () {
  'use strict';
  function boot() {
    var canvas = document.getElementById('game');
    var game = new window.V.Game(canvas);
    window.VELTHIROS = game;
    game.start();
    var splash = document.getElementById('boot');
    if (splash) {
      splash.classList.add('gone');
      setTimeout(function () { splash.parentNode && splash.parentNode.removeChild(splash); }, 500);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
