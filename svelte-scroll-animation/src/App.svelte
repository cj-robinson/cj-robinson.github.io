<script>
	import Visualization from './boat.svelte';
    import Scrolly from "./Scrolly.svelte";

	let conclusionVisible = false;
    let value;

	const steps = [
		"<p>Welcome to the Jones Falls stream in Baltimore, Maryland. </p><p> Meet Mr. Trash Wheel®",
		"<p>Mr. Trash Wheel® has a simple job. And that job is to consume garbage.",
		"<p>Here comes some now.</p>",
		"<p>This is one plastic bottle.</p>",
		"<p>Here is a cigarette butt.</p>",
		"<p>Anyone missing a ball? A glass bottle? Polyethylene? An old wrapper?</p>",
		"<p>Let's see how much garbage comes through in a typical day.</p>"
	];

	function updateConclusionVisibility() {
	  const conclusion = document.querySelector('.conclusion');
	  const visualizationEnd = document.querySelector('.spacer:last-of-type').getBoundingClientRect().top;
	  conclusionVisible = visualizationEnd < 0;
	}
  
	import { onMount } from 'svelte';
	onMount(() => {
	  window.addEventListener('scroll', updateConclusionVisibility);
	  return () => {
		window.removeEventListener('scroll', updateConclusionVisibility);
	  };
	});
  </script>
  
  <style>
	:global(body) {
		overflow-x: hidden;
	}
	.article-section {
	  padding: 20px;
	  max-width: 800px;
	  margin: 50px auto;
	}
  
	.step {
		height: 300vh;
		display: flex;
		place-items: center;
		justify-content: center;
	}

	.spacer {
	  height: 100vh; /* Ensures that the visualization starts off-screen */
	}
  
	.conclusion {
	  transition: visibility 0.3s linear;
	  visibility: hidden; /* Initially hidden, will be made visible dynamically */
	}

	.section-container {
		margin-top: 2em;
		transition: background 100ms;
		display: flex;
	}
	
	.sticky {
		position: sticky;
		top: 10%;
		width: 100%;
		display: flex;
		justify-content: center;
	}

	.step-content {
		font-size: 1rem;
		background: whitesmoke;
		color: #ccc;
		border-radius: 5px;
		padding: 1rem 1rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		transition: background 1000ms ease;
		box-shadow: 1px 1px 10px rgba(0, 0, 0, .2);
		right: 5%;
		position: absolute;
		text-align: left;
			width: 75%;
			margin: auto;
			max-width: 500px;
	}

	.step.active .step-content {
		background: white;
		color: black;
	}
	
	.steps-container,
	.sticky {
		height: 100%;
	}

	.steps-container {
		flex: 1 1 0%;
		z-index: 10;
	}



  </style>
  
  <article>
	<section class="article-section">
	  <h2>Garbage In, Garbage Out</h2>
	  <p>Society makes a lot of trash. We're not quite sure what to do with it.</p>
	  <p>Anthropomorphizing might help.</p>
	</section>
  
	<!-- Spacer to ensure visualization starts off-screen -->
	<div class="spacer"></div>
	<div class="section-container">
		<div class="steps-container">
		  <Scrolly bind:value>
			{#each steps as text, i}
			  <div class="step" class:active={value === i}>
				<div class="step-content">{@html text}</div>
			  </div>
			{/each}
			<div class="spacer" />
		  </Scrolly>
		</div>
		<div class="sticky">
		  <Visualization/>
		</div>
	  </div>

	<!-- Additional spacer to ensure the visualization scrolls fully out of frame -->
	<div class="spacer"></div>
  
	<section class="article-section conclusion" style="visibility: {conclusionVisible ? 'visible' : 'hidden'};">
	  <h2>Conclusions Drawn from the Visualization</h2>
	  <p>As we reflect on the visualization that has scrolled out of view, let's discuss the insights gathered. The movement and aggregation of circles within the defined area highlight the clustering tendency of data under certain conditions.</p>
	  <p>This visualization is not just a showcase of technical prowess but serves as a metaphor for the dynamic and sometimes unpredictable nature of data analysis. Understanding these patterns allows us to anticipate changes and adapt strategies effectively.</p>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>
	  <br>

	</section>
  </article>
  