const arrows = document.querySelectorAll('.arrow');

document.addEventListener('mousemove', (e) => {
  arrows.forEach(arrow => {
    const arrowRect = arrow.getBoundingClientRect();
    const arrowCenterX = arrowRect.left + arrowRect.width / 2;
    const arrowBottomY = arrowRect.top + arrowRect.height;

    const angle = Math.atan2(e.clientY - arrowBottomY, e.clientX - arrowCenterX) - 60;
    arrow.style.transform = `rotate(${angle}rad)`;
    arrow.style.transformOrigin = 'bottom center';
  });
});


document.querySelector('.scroll-arrow').addEventListener('click', () => {
  window.scrollTo({
    top: window.innerHeight,
    behavior: 'smooth'
  });
});

document.querySelector('.arrow-down').addEventListener('click', () => {
  window.scrollTo({
    top: window.innerHeight,
    behavior: 'smooth'
  });
});

function layoutMasonry() {
  const containers = document.querySelectorAll('.container > .columns.is-multiline');
  containers.forEach(container => {
    const width = container.offsetWidth;
    let cols;
    if (width >= 1024) cols = 3;
    else if (width >= 770) cols = 2;
    else cols = 1;

    const gap = 24;
    const colWidth = (width - gap * (cols - 1)) / cols;
    const colHeights = new Array(cols).fill(0);

    container.style.position = 'relative';

    const items = container.querySelectorAll(':scope > .column');
    items.forEach(item => {
      item.style.position = 'absolute';
      item.style.width = colWidth + 'px';
      item.style.padding = '0';
      item.style.margin = '0';

      const h = item.offsetHeight;

      let minCol = 0;
      for (let i = 1; i < cols; i++) {
        if (colHeights[i] < colHeights[minCol]) minCol = i;
      }
      const x = minCol * (colWidth + gap);
      const y = colHeights[minCol];
      item.style.left = x + 'px';
      item.style.top = y + 'px';
      colHeights[minCol] += h + gap;
    });

    container.style.height = Math.max(...colHeights) + 'px';
  });
}

let _masonryTimer;
function scheduleMasonry() {
  clearTimeout(_masonryTimer);
  _masonryTimer = setTimeout(layoutMasonry, 80);
}

window.addEventListener('load', layoutMasonry);
window.addEventListener('resize', scheduleMasonry);

document.fonts && document.fonts.ready && document.fonts.ready.then(layoutMasonry);
document.querySelectorAll('img').forEach(img => {
  if (!img.complete) img.addEventListener('load', scheduleMasonry);
});