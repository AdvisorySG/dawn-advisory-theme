const homepageBackground = new URL("./img/homepage-bg.jpg", import.meta.url);

function Home () {
    return (
        <div className="home-page-container">
            <div>
                <img src={homepageBackground} className="home-page-background"/>
                <h1>studyPals</h1>
                <p>A productivity application to help you plan out your busy days!</p>
            </div>
        </div>
    );
};

export default Home;