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