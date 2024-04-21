<script>
	import { onMount } from 'svelte';
  
	let objects = [];
	let windowHeight = 0;
	let windowWidth = 0;
	let initialScrollY = 0;
	let minInitialOffset = Number.MAX_VALUE;
	let maxInitialOffset = Number.MIN_VALUE;
	let currentHour = 0;
	let squareBounds = { top: 0, bottom: 0 };
  
	const objectConfigs = [
	  { type: 'waterbottle', number: 1981, imageSrc: 'water_bottle.svg' },
	  { type: 'cig', number: 18656, imageSrc: 'water_bottle.svg' },
	  { type: 'plasticbags', number: 867, imageSrc: 'water_bottle.svg' },
	  { type: 'plastics', number: 1462, imageSrc: 'water_bottle.svg' },
	  { type: 'glassbottles', number: 21, imageSrc: 'water_bottle.svg' },
	  { type: 'wrappers', number: 1427, imageSrc: 'water_bottle.svg' },
	  { type: 'sportsballs', number: 867, imageSrc: 'water_bottle.svg' },
	];

	let columns = 200;  // This can be adjusted based on the screen width or desired grid density
	let cellWidth = 10;
	let cellHeight = 10;

  
	onMount(() => {
	  windowHeight = window.innerHeight;
	  windowWidth = window.innerWidth;
	  initialScrollY = window.scrollY;
	  initObjects();
	  calculateGridPositions();
	  
	  window.addEventListener('scroll', handleScroll);
	  return () => {
		window.removeEventListener('scroll', handleScroll);
	  };
	});

	function calculateGridPositions() {
		let yStart = windowHeight - 600; // Starting below the viewport height
		let xStart = 0;
		objectConfigs.forEach(config => {
		let index = 0;
		objects.filter(obj => obj.type === config.type).forEach(obj => {
			let row = Math.floor(index / columns);
			let col = index % columns;
			obj.finalX = xStart + col * cellWidth;
			obj.finalY = yStart + row * cellHeight;
			index++;
		});
		yStart += (Math.ceil(config.number / columns) + 1) * cellHeight; // Move to next block
		});
	}


	function initObjects() {

		minInitialOffset = windowHeight * 22
		maxInitialOffset = windowHeight * 40
		objects = objectConfigs.flatMap(config => {

			return Array.from({ length: config.number }, (_, i) => {
			let earlyAppearanceOffset = 0;
			if (i < 1 & config.type === 'waterbottle') { // Assuming you want the first two objects of each type to appear earlier
				earlyAppearanceOffset = windowHeight * 12; // Smaller offset for earlier appearance
			} else if (i < 1 & config.type === 'cig') {
				earlyAppearanceOffset = windowHeight * 14.5; // Smaller offset for earlier appearance
			} else if (i < 1 & (config.type === 'wrappers' | config.type === 'plastics' | config.type === 'glassbottles' | config.type === 'sportsballs' |  config.type === 'plasticbags')) {
				earlyAppearanceOffset = windowHeight * 17.7; // Smaller offset for earlier appearance
			} else {
				earlyAppearanceOffset = minInitialOffset + Math.random() * (maxInitialOffset - minInitialOffset);
			}

			const originalHorizontal = Math.random() * 100
			return {
				id: `${config.type}-${i}`,
				type: config.type,
				imageSrc: config.imageSrc,
				initialOffset: earlyAppearanceOffset,
				horizontal: originalHorizontal,
				originalHorizontal: originalHorizontal
			};
			});
		});

	}

  
	function handleScroll() {
		const scrollY = window.scrollY;
		currentHour = Math.floor((scrollY - minInitialOffset) / (maxInitialOffset - minInitialOffset) * 24) % 24;

		if (scrollY >= maxInitialOffset) {
			// Move shapes to their final grid positions
			objects = objects.map(obj => ({
			...obj,
			horizontal: obj.finalX,
			offset: obj.finalY,
			transition: "left 5s, top 5s"
			}));
		} else {
			// Normal scroll behavior
			objects = objects.map(obj => {
			let newOffset = obj.initialOffset - scrollY;
			return {
				...obj,
				horizontal: obj.originalHorizontal,
				offset: newOffset <= squareBounds.top ? squareBounds.top : newOffset,
				transition: "none"
			};
			});
		}
		}
</script>
  
  
<style>
	.shape {
		width: 5px;
		height: 5px;
		border-radius: 25px;
		background-color: green;
	}
	.center-square {
		width: 100px;
		height: 100px;
		border: 2px solid black; 
		top: 10%;
		position: sticky
	}
	.hour-counter {
		width: 30%;
		text-align: center;
		background-color: #f0f0f0;
		padding: 10px;
		box-shadow: 0 2px 5px rgba(0,0,0,0.2);
		position: sticky;
	}
	.hour-counter-container{
		position: absolute;
		width: 100%
	}
</style>

<div class="center-square">
	{#each objects as { id, offset, horizontal, imageSrc, type, transition}}
		{#if type === 'waterbottle'}
			<div class="shape" style="position: absolute; background-color: blue; top: {offset}px; left: {horizontal}px; transition: {transition}" />
		{:else if type === 'plasticbags'}
			<div class="shape" style="position: absolute; background-color: green; top: {offset}px; left: {horizontal}px;  transition: {transition}" />
		{:else if type === 'plastics'}
			<div class="shape" style="position: absolute; background-color: purple; top: {offset}px; left: {horizontal}px; transition: {transition}" />
		{:else if type === 'wrappers'}
			<div class="shape" style="position: absolute; background-color: yellow; top: {offset}px; left: {horizontal}px; transition: {transition}" />
		{:else if type === 'sportsballs'}
			<div class="shape" style="position: absolute; background-color: orange; top: {offset}px; left: {horizontal}px; transition: {transition}" />
		{:else if type === 'cig'}
			<div class="shape" style="position: absolute; background-color: black; top: {offset}px; left: {horizontal}px; transition: {transition}" />
		{/if}
	{/each}
</div>
<div class="hour-counter-container">
	{#if window.scrollY >= minInitialOffset && window.scrollY <= maxInitialOffset}
		<div class="hour-counter" style="top: 20%; z-index: 10; right: 10%;">
			Current Hour: {currentHour}:00
		</div>
	{/if}
</div>
<div style="height: 30000px;"></div> <!-- Larger spacer to allow for extended scrolling -->
