import Header from './Header.js';
import Footer from './Footer.js';
import timer from "./img/timer.jpg";

function Timer () {
    return (
        <div class='timer'>
            <Header />
            <h1 class="title">Timer</h1>
            <div className='timer-img-container'>
                <img src={timer} className="timer-image"/>
            </div>
            <Footer />
        </div> 
    )
}

export default Timer;

