"use client";

import { useState, useEffect } from "react"; // <-- This is the fixed line
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
// 1. SORTABLE TASK ITEM COMPONENT (WITH NEW LOGIC)
// -----------------------------------------------------------------
function SortableTaskItem({ task, index, handleToggleComplete, handleDelete, handleUpdateTaskText }) {
  
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(task.text);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging, // We need this to stop animations
  } = useSortable({ id: task.id });

  // 👈 --- NEW LOGIC TO CHECK IF TASK IS #1 ---
  // This is true if the item is the first in the list
  const isPriorityOne = index === 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const onSave = () => {
    if (editText.trim() === "") return;
    handleUpdateTaskText(task.id, editText);
    setIsEditing(false);
  };

  const onCancel = () => {
    setIsEditing(false);
    setEditText(task.text);
  };


  // --- "EDIT" VIEW ---
  if (isEditing) {
    return (
      <li
        ref={setNodeRef}
        style={style}
        className="p-3 mb-2 rounded bg-white text-black flex justify-between items-center shadow-sm"
      >
        <input 
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="border p-2 rounded text-black w-full"
        />
        <div className="flex gap-2 ml-2">
          <button onClick={onSave} className="bg-green-500 text-white px-3 py-1 rounded">Save</button>
          <button onClick={onCancel} className="bg-gray-400 text-white px-3 py-1 rounded">Cancel</button>
        </div>
      </li>
    );
  }

  // --- "DISPLAY" VIEW (with new logic) ---
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`
        p-3 mb-2 rounded flex justify-between items-center shadow-sm
        ${task.isCompleted ? "bg-gray-400 text-gray-600" : "bg-white text-black"}
      `}
    >
      {/* 👈 --- UPDATED DRAG HANDLE WITH NEW LOGIC --- */}
      <div 
        {...attributes} 
        {...listeners} 
        // This logic applies all your new styles:
        className={`
          p-2 cursor-grab w-10 text-center font-bold transition-all
          ${isPriorityOne ? 'text-red-500 text-lg' : 'text-gray-500'}
          ${isDragging ? '' : (isPriorityOne ? 'animate-pulse-warning' : 'animate-tilt')}
        `}
      >
        {index + 1}
      </div>

      {/* Task Text */}
      <span 
        className={`flex-grow cursor-pointer ${task.isCompleted ? "line-through" : ""}`}
        onClick={() => handleToggleComplete(task.id, task.isCompleted)}
      >
        {task.text}
      </span>
      
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
// 2. OUR MAIN PAGE COMPONENT
// -----------------------------------------------------------------
export default function TodoPage() {
  
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState("");

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
        order: tasks.length 
      });
      setNewTask("");
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

  const handleUpdateTaskText = async (id, newText) => {
    try {
      const taskDocRef = doc(db, "tasks", id);
      await updateDoc(taskDocRef, {
        text: newText
      });
      fetchTasks();
    } catch (e) {
      console.error("Error updating document text: ", e);
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


  // -----------------------------------------------------------------
  // 3. MAIN JSX (RETURN)
  // -----------------------------------------------------------------
  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-24 bg-gray-100">
      <h1 className="text-4xl font-bold mb-8">My To-Do List</h1>

      <form 
        onSubmit={handleSubmit}
        className="flex flex-col sm:flex-row gap-2 mb-4 w-full max-w-md"
      >
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
      </form>

      <div className="w-full max-w-md">
        {tasks.length === 0 ? (
          // Empty State
          <div className="text-center p-10 bg-white rounded-lg shadow-sm">
            <p className="text-gray-500 font-semibold">You have no tasks!</p>
            <p className="text-gray-400 text-sm">Add one above to get started.</p>
          </div>
        ) : (
          // List
          <>
            {/* Info Bar */}
            <div className="flex justify-between items-center mb-2">
              <p className="text-gray-500 text-sm">
                {tasks.filter(t => !t.isCompleted).length} tasks left
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
                items={tasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <ul className="w-full">
                  {tasks.map((task, index) => (
                    <SortableTaskItem 
                      key={task.id} 
                      task={task} 
                      index={index}
                      handleToggleComplete={handleToggleComplete}
                      handleDelete={handleDelete}
                      handleUpdateTaskText={handleUpdateTaskText}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>
    </main>
  );
}