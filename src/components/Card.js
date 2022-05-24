import todolist from "./img/todolist.png";

function Card (props) {
    return (
        <div className="card">
            <img src={todolist}/>
            <p className="task">{ props.task }</p>
            <p className="day">{ props.day }</p>
            <p className="urgency">{ props.urgency }</p>
            {props.urgency === "High" ? 
                <div id="important">IMPORTANT</div> :
                props.urgency === "Medium" ? 
                    <div id="need-attention">NEED ATTENTION</div> :
                    <div id="on-track">ON TRACK</div>
            }
        </div>
    );
};

export default Card;