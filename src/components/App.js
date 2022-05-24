import Header from './Header.js';
import Home from './Home.js';
import Footer from './Footer.js';
import Card from './Card.js';

function Page () {
    return (
        <div class="container">
            <Header />
            <h1 class="title">Todo List</h1>
            {/* <Home /> */}
            <Card 
                task="Study math"
                day="Monday"
            />
            <Card 
                task="Study Chemistry"
                day="Monday"
            />
            <Card 
                task="Study History"
                day="Friday"
            />
            <Card 
                task="Study Biology"
                day="Sunday"
            />
            <Footer />
        </div>
    );
};

export default Page;