// Jeopardy quiz game functionality
document.addEventListener('DOMContentLoaded', function() {
// Game elements
const questionCategory = document.getElementById('question-category');
const questionValue = document.getElementById('question-value');
const questionText = document.getElementById('question-text');
const submitAnswer = document.getElementById('submit-answer');
const resultMessage = document.getElementById('result-message');
const nextQuestionButton = document.getElementById('next-question');

// Game state
let score = 0;
let currentQuestion = null;
let usedQuestions = new Set();
let data = null; // Global variable to store fetched data

// // Jeopardy questions data
fetch('data/jeopardy_questions.json')
    .then(response => response.json())
    .then(fetchedData => {
        data = fetchedData; // Assign fetched data to the global variable
        console.log(data); // Use the data as needed
        getRandomQuestion();
    })
    .catch(error => console.error('Error loading questions:', error));


//make fake data for testing with a list of objects that each have clue, answer and value
// const fakeData = {
//     questions: [
//         { clue: "The capital of France", answer: "Paris", value: 200 },
//         { clue: "The largest planet in our solar system", answer: "Jupiter", value: 400 },
//         { clue: "The author of 'Romeo and Juliet'", answer: "Shakespeare", value: 600 },
//         { clue: "The chemical symbol for gold", answer: "Au", value: 800 },
//         { clue: "The longest river in the world", answer: "Nile", value: 1000 }
//     ]
// };

// Simulate fetching data
// setTimeout(() => {
//     data = fakeData; // Assign fake data to the global variable
//     console.log(data); // Use the data as needed
//     getRandomQuestion();
// }, 1000);

// Event listeners
if (submitAnswer) {
    submitAnswer.addEventListener('click', checkAnswer);
}

if (nextQuestionButton) {
    nextQuestionButton.addEventListener('click', () => {
        getRandomQuestion(); // Load a new question
        resultMessage.textContent = ''; // Clear the result message
        nextQuestionButton.style.display = 'none'; // Hide the button
    });
}

// create function to get a random question
function getRandomQuestion() {
    document.getElementById('answer-input').value = '';

    //use the data from the fetch call
    const questions = data.questions;
    const randomIndex = Math.floor(Math.random() * questions.length);
    currentQuestion = questions[randomIndex];

    questionValue.textContent = "$".concat(currentQuestion.value);
    questionText.textContent = currentQuestion.clue;
}

// create function to check the answer
function checkAnswer() {
    console.log('Checking answer...');
    console.log('Current question:', currentQuestion);
    const userAnswer = document.getElementById('answer-input').value.trim().toLowerCase();
    console.log('User answer:', userAnswer);
    if (currentQuestion && userAnswer === currentQuestion.answer.toLowerCase()) {
        resultMessage.textContent = `Correct!`;
    } else {
        resultMessage.textContent = `That's not quite right. The correct answer was: ${currentQuestion.answer}`;
    }

    // Show the "Next Question" button
    nextQuestionButton.style.display = 'block';
}

});