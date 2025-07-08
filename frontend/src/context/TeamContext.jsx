import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '../api'  // 共通APIラッパー
// コンテキストを使うことで
// グローバル変数みたいな使い方ができる(prppsを連続させなくても)

// ① Context の作成
const TeamContext = createContext()

export const TeamProvider = ({ children }) => {
  // ② 所属チーム一覧＆選択中チームID
  const [teams, setTeams] = useState([])             
  const [currentTeamId, setCurrentTeamId] = useState(null)

  // ③ マウント時に自分のチーム一覧を取得
  useEffect(() => {
    api('/teams/', { method: 'GET' })
      .then(data => {
        setTeams(data)
        // デフォルトは「個人モード( null )」または先頭チーム
        // setCurrentTeamId(data.length > 0 ? data[0].id : null)
        setCurrentTeamId(null)
      })
      .catch(console.error)
  }, [])

  // ④ Context API で提供する値
  return (
    // こうすること(childrenを挟む)でteamcontentで挟んだらUseTheamをして各変数を呼ぶことが出来る。
    <TeamContext.Provider value={{
      teams,
      currentTeamId,
      // チーム選択用
      selectTeam: setCurrentTeamId,
      // チーム作成後などに一覧更新
      refreshTeams: () => api('/teams/').then(setTeams)
    }}>
      {children}
    </TeamContext.Provider>
  )
}

// ⑤ 利便性のためのカスタムフック
// 各ページでusecontentってやらずにUsetheam()を実行して各変数名で使える。
export const useTeam = () => useContext(TeamContext)
