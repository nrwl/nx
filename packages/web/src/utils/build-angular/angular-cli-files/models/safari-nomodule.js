(function () {
  var check = document.createElement('script');
  if (!('noModule' in check) && 'onbeforeload' in check) {
    var support = false;
    document.addEventListener('beforeload', function (e) {
      if (e.target === check) {
        support = true;
      } else if (!e.target.hasAttribute('nomodule') || !support) {
        return;
      }
      e.preventDefault();
    }, true);

    check.type = 'module';
    check.src = '.';
    document.head.appendChild(check);
    check.remove();
  }
}());
