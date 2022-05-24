import homepageBackground from "./img/homepage-bg.jpg";

function Home () {
    return (
        <div className="home-page-container">
            <h1>studyPal</h1>
            <p>A productivity application to help you plan out your busy days!</p>
            <img src={homepageBackground} className="home-page-background"/>
        </div>
    );
};

export default Home;