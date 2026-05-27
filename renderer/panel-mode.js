(function () {
  let active = false;

  function setActive(next) {
    const value = !!next;
    if (value === active) return;
    active = value;
    console.log('[panel-mode] active =', active);
  }

  function isActive() {
    return active;
  }

  window.ezvibesPanelMode = { setActive, isActive };
})();
