"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "./firebase"; 

import { 
  collection, 
  addDoc, 
  getDocs, 
  doc,        
  updateDoc,  
  deleteDoc,
  query,       
  orderBy,     
  writeBatch
} from "firebase/firestore";

// --- DND-KIT IMPORTS ---
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
// --- END IMPORTS ---


// -----------------------------------------------------------------
// 1. SORTABLE TASK ITEM COMPONENT (UPDATED FOR DUE DATES)
// -----------------------------------------------------------------
// 👈 --- 'today' prop is now accepted ---
function SortableTaskItem({ task, index, handleToggleComplete, handleDelete, handleUpdateTask, today }) {
  
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  const [editDate, setEditDate] = useState(task.dueDate || "");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const isPriorityOne = index === 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const onSave = () => {
    if (editText.trim() === "") return;
    handleUpdateTask(task.id, editText, editDate);
    setIsEditing(false);
  };

  const onCancel = () => {
    setIsEditing(false);
    setEditText(task.text);
    setEditDate(task.dueDate || "");
  };


  // --- "EDIT" VIEW (Updated with date input) ---
  if (isEditing) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className="p-3 mb-2 rounded bg-white text-black flex flex-col gap-2 shadow-sm"
      >
        <input 
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="border p-2 rounded text-black w-full"
        />
        <div className="flex justify-between gap-2">
          <input
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            className="border p-2 rounded text-black w-full"
            min={today} // 👈 --- 1. CHANGE IS HERE ---
          />
          <div className="flex gap-2">
            <button onClick={onSave} className="bg-green-500 text-white px-3 py-1 rounded">Save</button>
            <button onClick={onCancel} className="bg-gray-400 text-white px-3 py-1 rounded">Cancel</button>
          </div>
        </div>
      </li>
    );
  }

  // --- "DISPLAY" VIEW (Updated to show due date) ---
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`
        p-3 mb-2 rounded flex justify-between items-center shadow-sm
        ${task.isCompleted ? "bg-gray-400 text-gray-600" : "bg-white text-black"}
      `}
    >
      {/* Drag Handle */}
      <div 
        {...attributes} 
        {...listeners} 
        className={`
          p-2 cursor-grab w-10 text-center font-bold transition-all
          ${isPriorityOne ? 'text-red-500 text-lg' : 'text-gray-500'}
          ${isDragging ? '' : (isPriorityOne ? 'animate-pulse-warning' : 'animate-tilt')}
        `}
      >
        {index + 1}
      </div>

      {/* Task Text & Due Date */}
      <div className="flex-grow cursor-pointer" onClick={() => handleToggleComplete(task.id, task.isCompleted)}>
        <span className={` ${task.isCompleted ? "line-through" : ""}`}>
          {task.text}
        </span>
        {task.dueDate && (
          <p className={`text-xs ${task.isCompleted ? 'text-gray-600' : 'text-gray-500'}`}>
            Due: {task.dueDate}
          </p>
        )}
      </div>
      
      {/* Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setIsEditing(true)}
          className="bg-yellow-500 text-white px-3 py-1 rounded"
        >
          Edit
        </button>
        <button
          onClick={() => handleDelete(task.id)}
          className="bg-red-500 text-white px-3 py-1 rounded"
        >
          Delete
        </button>
      </div>
    </li>
  );
}


// -----------------------------------------------------------------
// 2. OUR MAIN PAGE COMPONENT (Updated with Filter)
// -----------------------------------------------------------------
export default function TodoPage() {
  
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [filter, setFilter] = useState("all");

  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  }));

  
  const fetchTasks = async () => {
    const tasksCollectionRef = collection(db, "tasks");
    const q = query(tasksCollectionRef, orderBy("order", "asc"));
    const querySnapshot = await getDocs(q);
    const tasksArray = [];
    querySnapshot.forEach((doc) => {
      tasksArray.push({ id: doc.id, ...doc.data() });
    });
    setTasks(tasksArray);
  };

  
  useEffect(() => {
    fetchTasks();
  }, []); 

  
  const handleAddTask = async () => {
    if (newTask.trim() === "") return; 
    try {
      await addDoc(collection(db, "tasks"), {
        text: newTask,
        isCompleted: false,
        order: tasks.length,
        dueDate: newDueDate || null
      });
      setNewTask("");
      setNewDueDate("");
      fetchTasks(); 
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  const handleClearCompleted = async () => {
    const completedTasks = tasks.filter(task => task.isCompleted);
    if (completedTasks.length === 0) return;
    
    try {
      const batch = writeBatch(db);
      completedTasks.forEach(task => {
        const taskRef = doc(db, "tasks", task.id);
        batch.delete(taskRef);
      });
      await batch.commit();
      fetchTasks();
    } catch (e) {
      console.error("Error clearing completed tasks: ", e);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault(); 
    handleAddTask(); 
  };

  const handleUpdateTask = async (id, newText, newDate) => {
    try {
      const taskDocRef = doc(db, "tasks", id);
      await updateDoc(taskDocRef, {
        text: newText,
        dueDate: newDate || null
      });
      fetchTasks();
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  };

  const handleDelete = async (id) => {
    try {
      const taskDocRef = doc(db, "tasks", id);
      await deleteDoc(taskDocRef);
      fetchTasks();
    } catch (e) {
      console.error("Error deleting document: ", e);
    }
  };

  const handleToggleComplete = async (id, isCompleted) => {
    try {
      const taskDocRef = doc(db, "tasks", id);
      await updateDoc(taskDocRef, {
        isCompleted: !isCompleted
      });
      fetchTasks();
    } catch (e) {
      console.error("Error updating document: ", e);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((t) => t.id === active.id);
      const newIndex = tasks.findIndex((t) => t.id === over.id);
      const newOrder = arrayMove(tasks, oldIndex, newIndex);
      setTasks(newOrder); 

      try {
        const batch = writeBatch(db);
        newOrder.forEach((task, index) => {
          const taskRef = doc(db, "tasks", task.id);
          batch.update(taskRef, { order: index });
        });
        await batch.commit();
      } catch (e) {
        console.error("Error updating order in Firebase: ", e);
        fetchTasks();
      }
    }
  };

  const filteredTasks = useMemo(() => {
    if (filter === "active") {
      return tasks.filter(task => !task.isCompleted);
    }
    if (filter === "completed") {
      return tasks.filter(task => task.isCompleted);
    }
    return tasks;
  }, [tasks, filter]);

  
  // -----------------------------------------------------------------
  // 3. MAIN JSX (RETURN)
  // -----------------------------------------------------------------
  
  // 👈 --- 2. GET TODAY'S DATE HERE ---
  const today = new Date().toISOString().split('T')[0];

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-24 bg-gray-100">
      <h1 className="text-5xl font-extrabold mb-8 text-gray-900">My To-Do List</h1>

      {/* --- Card Wrapper --- */}
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-6">

        {/* --- Form (Updated with Date Input) --- */}
        <form 
          onSubmit={handleSubmit}
          className="flex flex-col gap-2 mb-4 w-full"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newTask} 
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Enter a new task"
              className="border p-2 rounded text-black w-full"
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white px-4 py-2 rounded w-full sm:w-auto"
            >
              Add Task
            </button>
          </div>
          <input
            type="date"
            value={newDueDate}
            onChange={(e) => setNewDueDate(e.target.value)}
            className="border p-2 rounded text-black w-full"
            min={today} // 👈 --- 3. CHANGE IS HERE ---
          />
        </form>

        {/* --- List Section --- */}
        <div className="w-full">
          
          {/* --- Filter Buttons --- */}
          <div className="flex justify-center gap-2 mb-4 border-b pb-4">
            <button 
              onClick={() => setFilter("all")}
              className={`px-3 py-1 text-sm rounded-lg ${filter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              All
            </button>
            <button 
              onClick={() => setFilter("active")}
              className={`px-3 py-1 text-sm rounded-lg ${filter === 'active' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              Active
            </button>
            <button 
              onClick={() => setFilter("completed")}
              className={`px-3 py-1 text-sm rounded-lg ${filter === 'completed' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              Completed
            </button>
          </div>

          {filteredTasks.length === 0 ? (
            // Empty State
            <div className="text-center p-10">
              <p className="text-gray-500 font-semibold">
                {filter === 'all' ? 'You have no tasks!' : `No ${filter} tasks.`}
              </p>
              <p className="text-gray-400 text-sm">
                {filter === 'all' ? 'Add one above to get started.' : 'Keep up the good work!'}
              </p>
            </div>
          ) : (
            // List
            <>
              {/* Info Bar */}
              <div className="flex justify-between items-center mb-2">
                <p className="text-gray-500 text-sm">
                  {filteredTasks.filter(t => !t.isCompleted).length} tasks left
                </p>
                
                {tasks.some(t => t.isCompleted) && (
                  <button 
                    onClick={handleClearCompleted}
                    className="text-red-500 text-sm font-medium hover:text-red-700"
                  >
                    Clear Completed
                  </button>
                )}
              </div>
              
              <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext 
                  items={filteredTasks.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="w-full">
                    {filteredTasks.map((task, index) => (
                      <SortableTaskItem 
                        key={task.id} 
                        task={task} 
                        index={tasks.findIndex(t => t.id === task.id)}
                        handleToggleComplete={handleToggleComplete}
                        handleDelete={handleDelete}
                        handleUpdateTask={handleUpdateTask}
                        today={today} // 👈 --- 4. CHANGE IS HERE ---
                      />
                    ))}
                  </ul>
              </SortableContext>
            </DndContext>
            </>
          )}
        </div>

      </div> 
      {/* --- END OF CARD WRAPPER --- */}
      
    </main>
  );
}