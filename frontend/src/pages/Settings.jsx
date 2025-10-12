
import Settings_User from '../components/Settings/Settings_User';
import Settings_Subject_Task from '../components/Settings/Settings_Subject_Task';
import { useTeam } from '../context/TeamContext';
import Settings_Team from '../components/Settings/Settings_Team';
import Invition_Team from '../components/Settings/Invition_Team';
import Invited_Team from '../components/Settings/Invited_Team';
import { useState } from 'react';
import Leave_Team from '../components/Settings/Leave_Team';
// import TeamIntegrations from '../components/TeamIntegrations';

const Settings = () => {
  document.title="Torail|設定・招待"
  const { currentTeamId } = useTeam();
  const [inv,setInv]=useState(false);
  return (
    <div>
      <h1><i className="bi bi-gear"></i> 設定・招待</h1>
        {currentTeamId?(<><Settings_Team/><Leave_Team/><Invition_Team key={inv} set={()=>setInv(!inv)}/></>):(<Settings_User/>)}
        <Invited_Team key={inv} set={()=>setInv(!inv)}/>
        <Settings_Subject_Task/>
    </div>
  )
}

export default Settings