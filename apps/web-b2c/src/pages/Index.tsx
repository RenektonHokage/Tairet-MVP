import { HomeView } from "../components/prelaunch/HomeView";
import { PublicLayout } from "../components/prelaunch/PublicLayout";

const Index = () => {
  return <PublicLayout page="home" title="Inicio"><HomeView /></PublicLayout>;
};

export default Index;
