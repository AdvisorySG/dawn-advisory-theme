import Header from './Header.js';
import Footer from './Footer.js';
import calendar from "./img/calendar.jpg";


function Calendar () {
    return (
        <div class='calendar'>
            <Header />
            <h1 class="title">Calendar</h1>
            <div className='calendar-img-container'>
                <img src={calendar} className="calendar-image"/>
            </div>
            <Footer />
        </div> 
    )
}

export default Calendar;



