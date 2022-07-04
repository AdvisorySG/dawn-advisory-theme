import Header from './Header.js';
import Footer from './Footer.js';
import analytics from "./img/analytics.jpg";

function Analytics () {
    return (
        <div class='analytics'>
            <Header />
            <h1 class="title">Analytics</h1>
            <div className='analytics-img-container'>
                <img src={analytics} className="analytics-image"/>
            </div>
            <Footer />
        </div> 
    )
}

export default Analytics;

