import { Link } from 'react-router-dom'
import homepageBackground from "./img/homepage-bg.jpg";

function LandingPage() {
    return (
        <div class="landing-page">
            <div className="home-page-container">
                <h1>studyPal</h1>
                <p>A productivity application to help you plan out your busy days!</p>
                <div class='landing-page-button-container'>
                    <p class="landing-page-button"><Link to='/login'>Log in</Link></p>
                    <p class="landing-page-button"><Link to='/signup'>Sign up</Link></p>
                </div>
                <img src={homepageBackground} className="home-page-background"/>
            </div>
        </div>
    )
}

export default LandingPage;