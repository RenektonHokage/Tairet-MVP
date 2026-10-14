import { Navigate, useLocation } from "react-router-dom";
export default function Eventos(){const {search}=useLocation();return <Navigate to={"/halloween"+search} replace/>;}
