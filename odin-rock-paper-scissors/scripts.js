// Returns a randomised choice of rock / paper / scissors 
function computerPlay() {
    const choices = ['rock', 'paper', 'scissors']
    let index = Math.floor(Math.random() * choices.length)
    return choices[index]
}

// Prompts users to make a selection
function playerPlay() {
    let playerSelection = prompt("Enter your choice")
    return playerSelection
}

// Complete 1 play round
function playRound(playerSelection, computerSelection) {
    playerSelection = playerSelection.toLowerCase()
    if (playerSelection == computerSelection) {
        console.log('It is a draw!')
        return 'draw'
    } else if ( playerSelection == 'rock' && computerSelection == 'scissors' || 
                playerSelection == 'scissors' && computerSelection == 'paper' ||
                playerSelection == 'paper' && computerSelection == 'rock' ) {
        console.log('Player wins!')
        return 'player'
    } else {
        console.log('Computer wins!')
        return 'computer'
    }
}

// Complete a game of 5 rounds
function play() {
    const winners = []
    for (let i = 0; i < 5; i++) {
        let winner = playRound(playerPlay(), computerPlay())
        winners.push(winner)
    }
    numPlayerWins = winners.filter((winner) => winner == 'player')
    numComputerWins = winners.filter((winner) => winner == 'computer')
    return numPlayerWins > numComputerWins ? 'You win!' : 'Computer wins!'
}
