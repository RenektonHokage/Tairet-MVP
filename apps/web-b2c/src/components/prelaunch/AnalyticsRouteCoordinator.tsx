import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { observeAnalyticsRoute } from "./analyticsRuntime";

export default function AnalyticsRouteCoordinator(){
 const {pathname,search}=useLocation();
 useLayoutEffect(()=>{observeAnalyticsRoute(pathname,search);},[pathname,search]);
 return null;
}
