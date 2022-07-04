import Header from './Header.js';
import Footer from './Footer.js';
import achievements from "./img/achievements.jpg";

function Achievements () {
    return (
        <div class='achievements'>
            <Header />
            <h1 class="title">Achievements</h1>
            <div className='achievements-img-container'>
                <img src={achievements} className="achievements-image"/>
            </div>
            <Footer />
        </div> 
    )
}

export default Achievements;
