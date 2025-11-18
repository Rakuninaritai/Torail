
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TimerRecord from './TimerRecord';
import DeleteTimer from '../Records/DeleteTimer';
import SectoMin from './SectoMin';
import { api } from "../../api";
import { useTeam } from '../../context/TeamContext';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { toast } from 'react-toastify';
import MediaPipeMonitor from './MediaPipeMonitor';
import useSound from '../../utils/useSound';

/** --- PiP 用のミニ UI コンポーネント ---------------- */
const TimerPiPView = ({
  time,
  timerState,
  onSuspend,
  onContinue,
  onFinish,
  onDelete,
  onClose,
}) => {
  // time は「秒」なので SectoMin と同じ DD:HH:MM:SS をここで作っても OK
  const total = Number(time || 0);
  const secs = total % 60;
  const mins = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600) % 24;
  const days = Math.floor(total / (3600 * 24));

  const fmt = (n) => String(n).padStart(2, '0');

  return (
    <div
      style={{
        fontFamily: 'system-ui, sans-serif',
        padding: '8px 12px',
        fontSize: '14px',
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: 4,
          fontSize: '15px',
        }}
      >
        Torail Timer
      </div>

      <div
        style={{
          marginBottom: 8,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>
          状態：
          <strong>{timerState ?? '-'}</strong>
        </span>
      </div>

      <div
        style={{
          fontVariantNumeric: 'tabular-nums',
          fontSize: '18px',
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {fmt(days)}:{fmt(hours)}:{fmt(mins)}:{fmt(secs)}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        {timerState === '実行中' && (
          <button
            type="button"
            onClick={onSuspend}
            style={{ padding: '4px 8px' }}
          >
            停止
          </button>
        )}
        {timerState === '中断中' && (
          <button
            type="button"
            onClick={onContinue}
            style={{ padding: '4px 8px' }}
          >
            再開
          </button>
        )}
        <button type="button" onClick={onFinish} style={{ padding: '4px 8px' }}>
          保存
        </button>
        <button type="button" onClick={onDelete} style={{ padding: '4px 8px' }}>
          削除
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{ padding: '4px 8px', marginLeft: 'auto' }}
        >
          PiP終了
        </button>
      </div>
    </div>
  );
};

/**
 * TimerControl
 * - タイマー中断・再開・終了を制御
 * - MediaPipeMonitor連携で自動中断/再開/ジェスチャ制御
 * - Document Picture-in-Picture でミラー表示
 */
const TimerControl = ({ token, records, settimerchange }) => {
  const { playPause, playResume } = useSound();
  const unlockedRef = useRef(false);
  const unlockAudio = async () => {
    if (unlockedRef.current) return;
    try {
      await playResume();
    } catch {}
    unlockedRef.current = true;
  };

  const [isLoading, setLoading] = useState(false);
  const { currentTeamId } = useTeam();
  const [errors, setErrors] = useState("");

  // カメラ監視 ON/OFF（ユーザトグル・UI は今は出してないがフラグは残しておく）
  const [camEnabled] = useState(true);

  // 時間・状態
  const [time, setTime] = useState(0);            // 秒
  const [timerState, setTimerState] = useState(); // "実行中" / "中断中" / "保存中"

  const timerIdRef = useRef(null);

  // === PiP 関係 =====================================
  const [pipWindow, setPipWindow] = useState(null);
  const isPiPActive = !!pipWindow;

  // 二重操作防止
  const opBusyRef = useRef(false);
  const withBusy = (fn) => async (...args) => {
    if (opBusyRef.current) return;
    opBusyRef.current = true;
    try {
      await fn(...args);
    } finally {
      opBusyRef.current = false;
    }
  };

  // NOTE: records は単一レコード想定
  const record = records ?? null;

  // 経過時間取り出し(中断していたらその数字、していないなら0)
  const inialElaapsed = record?.duration ? record.duration : 0; // ms
  const subtr = record?.stop_time
    ? new Date(record.stop_time)
    : record?.start_time
    ? new Date(record.start_time)
    : null;

  // ==== PiP オープン / クローズ =====================

  const closePiPWindow = () => {
    if (pipWindow) {
      try {
        pipWindow.close();
      } catch {}
    }
    setPipWindow(null);
  };

  const openPiPWindow = async () => {
    // 既に開いていれば何もしない
    if (pipWindow) return;

    if (typeof window === 'undefined') return;

    // 正しい対応チェック
    if (!('documentPictureInPicture' in window)) {
      toast.error("Document Picture-in-Picture に対応していないブラウザです。");
      return;
    }

    try {
      const win = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 180,
      });

      // PiP が閉じられたとき
      win.addEventListener('pagehide', () => {
        setPipWindow(null);
      });

      setPipWindow(win);
    } catch (e) {
      console.error(e);
      toast.error("PiP ウィンドウの生成に失敗しました。");
    }
  };

  // 既に開いている PiP に再アタッチ（HMR / 再マウント対策）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('documentPictureInPicture' in window)) return;

    const existing = window.documentPictureInPicture.window;
    if (existing && !pipWindow) {
      setPipWindow(existing);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // タイマー状態が「保存中」になったら PiP は閉じる
  useEffect(() => {
    if (record?.timer_state === 3 && pipWindow) {
      closePiPWindow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.timer_state]);

  // ==== record → time / timerState の同期 ==============
  useEffect(() => {
    if (!record) return;
    setLoading(true);

    clearInterval(timerIdRef.current);

    if (record.timer_state === 0) {
      setTimerState("実行中");
      timerIdRef.current = setInterval(() => {
        if (!subtr) return;
        const elapsedSec = Math.floor(
          (Date.now() - subtr.getTime()) / 1000 + inialElaapsed / 1000
        );
        setTime(elapsedSec);
        const mins = Math.floor(elapsedSec / 60);
        const secs = Math.floor(elapsedSec % 60);
        const taskName = record?.task?.name ?? "Timer";
        try {
          document.title = `${taskName}:${mins}分${secs}秒`;
        } catch {}
      }, 1000);
    }

    if (record.timer_state === 1) {
      setTimerState("中断中");
      setTime(Math.floor(inialElaapsed / 1000));
      try {
        document.title = `${record?.task?.name ?? "Timer"}:中断中`;
      } catch {}
    }

    if (record.timer_state === 3) {
      setTimerState("保存中");
      try {
        document.title = `${record?.task?.name ?? "Timer"}:保存中`;
      } catch {}
    }

    setLoading(false);

    return () => {
      clearInterval(timerIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    record?.id,
    record?.timer_state,
    record?.start_time,
    record?.stop_time,
    inialElaapsed,
    currentTeamId,
  ]);

  // ==== 中断 ====
  const handleSuspend = async () => {
    if (!record) return;
    setLoading(true);
    const updateData = {
      duration: time * 1000,
      end_time: new Date().toISOString(),
      timer_state: 1,
    };
    try {
      await api(`/records/${record.id}/`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
      toast.success("タイマーを中断しました!");
      try {
        await playPause();
      } catch {}
      clearInterval(timerIdRef.current);
      settimerchange();
    } catch (err) {
      setErrors(err);
      toast.error("タイマー中断に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // ==== 再開 ====
  const handleContinue = async () => {
    if (!record) return;

    // 要件: 「再開ボタンを押した瞬間に PiP 自動表示 OK」
    openPiPWindow();

    setLoading(true);
    const updateData = {
      stop_time: new Date().toISOString(),
      timer_state: 0,
    };
    try {
      await api(`/records/${record.id}/`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
      toast.success("タイマーが再開しました!");
      try {
        await playResume();
      } catch {}
      clearInterval(timerIdRef.current);
      settimerchange();
    } catch (err) {
      setErrors(err);
      toast.error("タイマー再開に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // ==== 終了 ====
  // const handleFinish = async () => {
  //   if (!record) return;
  //   if (!window.confirm("本当に終了してもよいですか？")) return;
  //   setLoading(true);

  //   const endtimeIso =
  //     timerState === "中断中" && record?.end_time
  //       ? new Date(record.end_time).toISOString()
  //       : new Date().toISOString();

  //   const updateData = {
  //     duration: time * 1000,
  //     end_time: endtimeIso,
  //     timer_state: 3,
  //   };
  //   try {
  //     await api(`/records/${record.id}/`, {
  //       method: "PATCH",
  //       body: JSON.stringify(updateData),
  //     });
  //     toast.success("タイマーが停止しました!");
  //     clearInterval(timerIdRef.current);
  //     settimerchange();
  //   } catch (err) {
  //     setErrors(err);
  //     toast.error("タイマー停止に失敗しました。");
  //   } finally {
  //     setLoading(false);
  //   }
  // };
    // ==== 終了（共通ロジック） ====
  const finishTimer = async ({ fromPiP = false } = {}) => {
    if (!record) return;

    // PiPからは確認ダイアログ無し、親からは従来通り確認
    if (!fromPiP) {
      if (!window.confirm("本当に終了してもよいですか？")) return;
    }

    setLoading(true);

    const endtimeIso =
      timerState === "中断中" && record?.end_time
        ? new Date(record.end_time).toISOString()
        : new Date().toISOString();

    const updateData = {
      duration: time * 1000,
      end_time: endtimeIso,
      timer_state: 3,
    };

    try {
      await api(`/records/${record.id}/`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
      toast.success("タイマーが停止しました!");
      clearInterval(timerIdRef.current);

      // PiP からの保存なら、その場で PiP を閉じて親に戻す
      if (fromPiP) {
        closePiPWindow();
      }

      settimerchange();
    } catch (err) {
      setErrors(err);
      toast.error("タイマー停止に失敗しました。");
    } finally {
      setLoading(false);
    }
  };


  // ==== 削除 ====
  const handleDelete = async () => {
    if (!record) return;
    if (!window.confirm("このタイマーを削除してもよいですか？")) return;

    setLoading(true);
    try {
      await api(`/records/${record.id}/`, {
        method: "DELETE",
      });
      toast.success("タイマーを削除しました。");
      closePiPWindow();
      settimerchange();
    } catch (err) {
      setErrors(err);
      toast.error("タイマーの削除に失敗しました。");
    } finally {
      setLoading(false);
    }
  };

  // === ここから JSX ==================================
  return (
    <div className="timer-card mx-auto">
      {/* PiP ウィンドウ内の React Portal（←常に描画しておく） */}
      {pipWindow &&
        createPortal(
          <TimerPiPView
            time={time}
            timerState={timerState}
            onSuspend={withBusy(handleSuspend)}
            onContinue={withBusy(handleContinue)}
            onFinish={withBusy(() => finishTimer({ fromPiP: true }))}
            onDelete={withBusy(handleDelete)}
            onClose={closePiPWindow}
          />,
          pipWindow.document.body
        )}


      {/* record 無い時も PiP は維持しつつ Skeleton だけ出す */}
      {!record ? (
        <Skeleton />
      ) : record.timer_state === 3 ? (
        <TimerRecord
          token={token}
          record={record}
          settimerchange={settimerchange}
        />
      ) : (
        <div>
          {/* 送信エラー */}
          {errors?.detail && (
            <div className="text-danger mt-1">
              <div>{errors.detail}</div>
            </div>
          )}
          {errors?.non_field_errors && (
            <div className="alert alert-danger">
              {errors.non_field_errors.map((msg, i) => (
                <div key={i}>{msg}</div>
              ))}
            </div>
          )}

          {isLoading ? (
            <Skeleton />
          ) : (
            <>
              {/* PiP 中は親 UI 非表示の代わりにメッセージだけ表示 */}
              {isPiPActive && (
                <div className="alert alert-info mb-3">
                  <div>現在、このタイマーは Picture-in-Picture で表示中です。</div>
                  <div>操作は PiP ウィンドウから行ってください。</div>
                </div>
              )}

              {/* === MediaPipeMonitor（ロジックは PiP 中も動かす / プレビューだけ OFF） === */}
              <div className="mb-2">
                <MediaPipeMonitor
                  enabled={camEnabled && record?.timer_state !== 3}
                  timerStateNum={record?.timer_state}
                  onAway={withBusy(async () => {
                    if (record?.timer_state === 0) await handleSuspend();
                  })}
                  onFist={withBusy(async () => {
                    if (record?.timer_state === 0) await handleSuspend();
                  })}
                  onPalm={withBusy(async () => {
                    if (record?.timer_state === 1) await handleContinue();
                  })}
                  awayThresholdMs={10_000}
                  gestureCooldownMs={1200}
                  frameIntervalMs={80}
                  showPreview={!isPiPActive} // PiP 中はプレビューだけ消す
                  autoResume={true}
                />
              </div>

              {/* === タイマー UI（PiP 中はまるごと隠す） === */}
              <div className={isPiPActive ? "d-none" : ""}>
                <h5>トピック: {record?.subject?.name ?? "-"}</h5>
                <h5>タスク: {record?.task?.name ?? "-"}</h5>
                <h5>ユーザー: {record?.user?.username ?? "-"}</h5>
                <SectoMin times={time} />

                <div className="d-flex justify-content-center gap-3 mt-3">
                  {timerState === "実行中" && (
                    <button
                      className="btn btn-secondary btn-lg"
                      onClick={withBusy(async () => {
                        await unlockAudio();
                        await handleSuspend();
                      })}
                    >
                      <i className="bi bi-stop-fill"></i>
                    </button>
                  )}
                  {timerState === "中断中" && (
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={withBusy(async () => {
                        await unlockAudio();
                        await handleContinue();
                      })}
                    >
                      <i className="bi bi-play-fill"></i>
                    </button>
                  )}
                  <button
                    className="btn btn-info btn-lg"
                    onClick={withBusy(() => finishTimer({ fromPiP: false }))}
                  >
                    <i className="bi bi-save"></i>
                  </button>

                  {/* PiP 表示ボタン */}
                  {!isPiPActive && (
                    <button
                      type="button"
                      className="btn btn-outline-dark btn-lg"
                      onClick={withBusy(openPiPWindow)}
                    >
                      PiP表示
                    </button>
                  )}

                  <DeleteTimer
                    token={token}
                    record={record}
                    settimerchange={settimerchange}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default TimerControl;
