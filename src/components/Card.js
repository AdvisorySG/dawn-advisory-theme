import todolist from "./img/todolist.png";

function Card (props) {
    return (
        <form className="card">
            <div class="card-topbar">
                <img src={todolist} className="img-todo"/>
                <button class="edit-todo">Edit</button>
                <button class="delete-todo">Delete</button>
            </div>
            <p className="task">Task : { props.task }</p>
            <p className="day">Due date : { props.day }</p>
            <p className="urgency">Urgency : { props.urgency }</p>
            {props.urgency === "High" ? 
                <div id="important">IMPORTANT</div> :
                    props.urgency === "Medium" ? 
                        <div id="need-attention">NEED ATTENTION</div> :
                        <div id="on-track">ON TRACK</div>
            }
        </form>
    );
};

export default Card;