
import Settings_User from '../components/Settings_User';
import Settings_Subject_Task from '../components/Settings_Subject_Task';

const Settings = () => {
  
  return (
    <div>
      <h1><i className="bi bi-gear"></i> 設定</h1>
        <Settings_User/>
        <Settings_Subject_Task/>
    </div>
  )
}

export default Settings