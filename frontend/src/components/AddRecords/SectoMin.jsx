

// 秒から分や時間日に変えるコンポネ
const SectoMin = ({times}) => {
  // 2桁ゼロ埋め function
  // 引数nを文字列にして長さを2にする。(2出ない場合は0を前に追加)
  const Z = n => String(n).padStart(2, '0')
  const sec=times
  // 日数(秒を1日の86400秒で割る)
  const days = Math.floor(sec/ 86400);
  // 残り秒数から時間(1日の余りを時間で割る)
  const hours = Math.floor((sec % 86400) / 3600);
  // 残り秒数から分(時間の余りを分で割る)
  const minutes = Math.floor((sec % 3600) / 60);
  // 残り秒数から秒(分になれなかったやつ)
  const seconds = sec % 60;
  return (
    // <h1> で大きめに、中央寄せにも
    <h1 className="text-center m-3" id="timerDisplay" >
      {Z(days)}:{Z(hours)}:{Z(minutes)}:{Z(seconds)}
    </h1>
  )
}

export default SectoMin