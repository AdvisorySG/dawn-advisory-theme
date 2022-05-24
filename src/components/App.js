import Header from './Header.js';
import Home from './Home.js';
import Footer from './Footer.js';
import Card from './Card.js';
import UserTasks from './UserTasks.js';

function Page () {
    const userTasks = UserTasks.map(item => {
        return <Card
                    task = {item.task}
                    day = {item.day}
                    urgency = {item.urgency}
                />
    });

    return (
        <div class="container">
            <Header />
            <h1 class="title">Todo List</h1>
            {/* <Home /> */}
            <Card 
                task="Study math"
                day="Monday"
                urgency="High"
            />
            <Card 
                task="Study Chemistry"
                day="Tuesday"
                urgency="High"
            />
            <Card 
                task="Study History"
                day="Friday"
                urgency="Medium"
            />
            <Card 
                task="Study Biology"
                day="Sunday"
                urgency="Low"
            />
            <Footer />
        </div>
    );
};

export default Page;