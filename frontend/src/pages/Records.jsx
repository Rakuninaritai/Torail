import React from 'react'
import RecordsList from '../components/RecordsList'

const Records = ({token,koushin }) => {
  return (
    <div>
      <h1><i className="bi bi-bar-chart"></i> 統計</h1>
      <RecordsList token={token} key={koushin} />
    </div>
  )
}

export default Records