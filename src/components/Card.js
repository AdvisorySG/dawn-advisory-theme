import todolist from "./img/todolist.png";

function Card (props) {
    return (
        <div className="card">
            <img src={todolist}/>
            <p className="task">{ props.task }</p>
            <p className="day">{ props.day }</p>
            <p className="urgency">{ props.urgency }</p>
        </div>
    );
};

export default Card;