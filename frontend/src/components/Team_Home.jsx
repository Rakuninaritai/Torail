import React, { useEffect, useState } from 'react'
import { useTeam } from '../context/TeamContext';
import { api } from "../api";
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const Team_Home = () => {
  const [isLoading, setLoading] = useState(false);
  const { currentTeamId } = useTeam();
  // ユーザー一覧
  const [initialData, setinitialData] = useState({ memberships: [] });
  const [errors,setErrors]=useState("")
  useEffect(()=>{
      const shutoku = async ()=>{
                setLoading(true)
                try{
                  // const ss=await api(`/users/`,{
                  //   method: 'GET',
                  // })
                  const tm=await api(`/teams/${currentTeamId}/`,{
                    method: 'GET',
                  })
                  setinitialData(tm)
                  setLoading(false)
                  // console.log(tm)
                  
                }catch (err) {
                  // console.error(err);
                  setLoading(false)
                  setErrors(err)
                }
                  
              }
              shutoku()
    },[currentTeamId])
  return (
    // <div>
    //   {/* チーム名 */}
    //   <h2>{initialData.name}</h2>
    //   {/* メンバー */}
    //   <ul className="list-group" id="userResult">
    //     {initialData&&initialData.memberships.map(user=>(
    //         <li  key={user.id}  className="list-group-item d-flex justify-content-between align-items-center">
    //       <div className="d-flex align-items-center gap-2">
    //         <img
    //           src="https://placehold.co/32x32"
    //           alt="avatar"
    //           width="32"
    //           height="32"
    //           className="rounded-circle"
    //         />
    //         <span className="fw-semibold">{user.user}</span>
    //         {/* <small className="text-muted ms-1">{user.email}</small> */}
    //       </div>

          
    //     </li>
    //     ))}
        
    //   </ul>
    // </div>
    <div className="container mt-4">
      <div className="card">
        {/* カードのヘッダー部分にチーム名 */}
        <div className="card-header bg-primary text-white">
          <h5 className="mb-0">{initialData.name}</h5>
        </div>

        {/* list-group-flush で境界線をカードと馴染ませる */}
        <ul className="list-group list-group-flush">
          {isLoading?<Skeleton/>:(
            <>
              {(initialData.memberships ?? []).map(user => (
              <li
                key={user.id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                <div className="d-flex align-items-center">
                  <img
                    src="https://placehold.co/32x32"
                    alt="avatar"
                    width="32"
                    height="32"
                    className="rounded-circle me-3"
                  />
                  <div>
                    <div className="fw-semibold">{user.user}</div>
                    {/* メールアドレスなどを表示したいとき */}
                    {/* <div className="text-muted small">{user.email}</div> */}
                  </div>
                </div>
                {/* 右側にボタンなどを置くことも可能 */}
                {/* <button className="btn btn-sm btn-outline-danger">削除</button> */}
              </li>
            ))}
            {initialData.memberships.length === 0 && (
              <li className="list-group-item text-center text-muted">
                メンバーがまだいません
              </li>
            )}
            </>
          )}
          
        </ul>
      </div>
    </div>
  )
}

export default Team_Home