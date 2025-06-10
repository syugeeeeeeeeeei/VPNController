import { useEffect, useMemo, useRef, useState } from "react";
import type { VPNConnection, VPNStatus } from "../../types";
import type { } from "../../types/preload";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

import { Pencil, PlusCircle, Settings, Trash2, XCircle } from "lucide-react";
import { Toaster, toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "../components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../components/ui/select";

type ConnectionForm = Omit<VPNConnection, "id"> & { password?: string };

const LogViewer = ({ logs }: { logs: string[] }): React.JSX.Element => {
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-lg shadow-inner overflow-hidden">
      <div className="p-3 bg-slate-800 text-slate-300 font-semibold text-sm border-b border-slate-700">
        プロセスログ
      </div>
      {/* ★ divに `custom-scrollbar` クラスを追加 */}
      <div ref={logContainerRef} className="flex-grow h-0 p-4 overflow-auto custom-scrollbar">
        <pre className="text-xs h-full text-slate-300 whitespace-pre-wrap break-words">
          {logs.join("\n")}
        </pre>
      </div>
    </div>
  );
};

function App(): React.JSX.Element {
  const [connections, setConnections] = useState<VPNConnection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vpnStatus, setVpnStatus] = useState<VPNStatus>("disconnected");
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const [isConnDialogOpen, setIsConnDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<VPNConnection | null>(null);
  const [cliPath, setCliPath] = useState("");
  const [isCliPathValid, setIsCliPathValid] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchInitialData = async (): Promise<void> => {
      try {
        const [conns, initialStatus, path] = await Promise.all([
          window.api.getConnections(),
          window.api.getStatus(),
          window.api.getCliPath()
        ]);
        setConnections(conns);
        setVpnStatus(initialStatus);
        setCliPath(path);
        if (conns.length > 0 && !selectedId) {
          setSelectedId(conns[0].id);
        }
      } catch (error) {
        toast.error("初期データの読み込みに失敗しました。", {
          description: (error as Error).message
        });
      }
    };
    fetchInitialData();

    const cleanupStatus = window.api.onVpnStatusChanged((newStatus) => {
      setVpnStatus(newStatus);
      const isBusy = newStatus === "connecting" || newStatus === "disconnecting";
      setIsProcessing(isBusy);

      if (newStatus === "connected") toast.success("VPNに接続しました。");
      if (newStatus === "disconnected") toast.info("VPNが切断されました。");
      if (newStatus === "error") toast.error("VPN接続でエラーが発生しました。");
    });

    const cleanupLogs = window.api.onVpnLog((log) => {
      setLogs((prevLogs) => [...prevLogs, log]);
    });

    return () => {
      cleanupStatus();
      cleanupLogs();
    };
  }, []);

  const connectButtonProps = useMemo(
    () => ({
      text: vpnStatus === "connected" ? "切断" : "接続",
      variant: (vpnStatus === "connected" ? "destructive" : "default") as "default" | "destructive",
      colorClass: vpnStatus === "connected" ? "" : "bg-teal-600 hover:bg-teal-700"
    }),
    [vpnStatus]
  );

  const isOperationDisabled = useMemo(
    () => isProcessing || vpnStatus === "connecting" || vpnStatus === "disconnecting",
    [isProcessing, vpnStatus]
  );

  const handleConnectToggle = async (): Promise<void> => {
    if (!selectedId && vpnStatus === "disconnected") {
      toast.error("接続先を選択してください。");
      return;
    }
    setLogs([]);
    try {
      if (vpnStatus === "connected") {
        await window.api.disconnect();
      } else {
        await window.api.connect(selectedId!);
      }
    } catch (error) {
      toast.error("VPN操作に失敗しました。", { description: (error as Error).message });
      setVpnStatus("error");
      setIsProcessing(false);
    }
  };

  const handleInterrupt = async (): Promise<void> => {
    try {
      await window.api.interrupt();
      toast.warning("接続を中断しました。");
    } catch (error) {
      toast.error("中断処理に失敗しました。", { description: (error as Error).message });
    }
  };

  const handleAddClick = (): void => {
    setEditingConn(null);
    setIsConnDialogOpen(true);
  };

  const handleEditClick = (): void => {
    if (!selectedId) return;
    const conn = connections.find((c) => c.id === selectedId);
    if (conn) {
      setEditingConn(conn);
      setIsConnDialogOpen(true);
    }
  };

  const handleDeleteClick = async (): Promise<void> => {
    if (!selectedId) return;
    if (confirm("本当にこの接続情報を削除しますか？")) {
      try {
        await window.api.deleteConnection(selectedId);
        toast.success("接続情報を削除しました。");
        const newConnections = connections.filter((c) => c.id !== selectedId);
        setConnections(newConnections);
        setSelectedId(newConnections.length > 0 ? newConnections[0].id : null);
      } catch (error) {
        toast.error("削除に失敗しました。", { description: (error as Error).message });
      }
    }
  };

  const handleSaveConnection = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: ConnectionForm = {
      name: formData.get("name") as string,
      host: formData.get("host") as string,
      username: formData.get("username") as string,
      password: formData.get("password") as string
    };

    try {
      if (editingConn) {
        const updatedConn = { ...editingConn, ...data };
        await window.api.updateConnection(updatedConn, data.password);
        toast.success("接続情報を更新しました。");
        setConnections(connections.map((c) => (c.id === editingConn.id ? updatedConn : c)));
      } else {
        const newConn = await window.api.addConnection(data, data.password!);
        toast.success("接続情報を追加しました。");
        setConnections([...connections, newConn]);
        setSelectedId(newConn.id);
      }
      setIsConnDialogOpen(false);
    } catch (error) {
      toast.error("保存に失敗しました。", { description: (error as Error).message });
    }
  };

  const handleValidateCliPath = async (): Promise<void> => {
    const isValid = await window.api.validateCliPath(cliPath);
    setIsCliPathValid(isValid);
    toast[isValid ? "success" : "error"](
      `CLIパスは${isValid ? "有効です。" : "無効か、または存在しません。"}`
    );
  };

  const handleSaveSettings = async (): Promise<void> => {
    try {
      await window.api.setCliPath(cliPath);
      toast.success("設定を保存しました。");
      setIsSettingsDialogOpen(false);
    } catch (error) {
      toast.error("設定の保存に失敗しました。", { description: (error as Error).message });
    }
  };

  return (
    // ★ 全体コンテナに overflow-hidden を追加
    <div className="w-full h-screen bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-50 flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full h-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-full">
          <LogViewer logs={logs} />
        </div>
        <div className="flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-2xl">VPN Connector</CardTitle>
              <CardDescription>Cisco Secure Clientを簡単に操作します。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>接続先</Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedId ?? ""}
                    onValueChange={setSelectedId}
                    disabled={isOperationDisabled}
                  >
                    <SelectTrigger className="flex-1 min-w-0">
                      <SelectValue placeholder="接続先を選択..." className="truncate" />
                    </SelectTrigger>
                    <SelectContent>
                      {connections.map((conn) => (
                        <SelectItem key={conn.id} value={conn.id} className="truncate">
                          {conn.name} ({conn.host})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleAddClick}
                    disabled={isOperationDisabled}
                  >
                    <PlusCircle className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEditClick}
                    disabled={!selectedId || isOperationDisabled}
                  >
                    <Pencil className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeleteClick}
                    disabled={!selectedId || isOperationDisabled}
                  >
                    <Trash2 className="h-5 w-5 text-red-500" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <Badge
                  variant={vpnStatus === "connected" ? "default" : "secondary"}
                  className={`${vpnStatus === "connected" ? "bg-teal-500 text-white" : ""} transition-colors text-sm px-3 py-1`}
                >
                  {vpnStatus.toUpperCase()}
                </Badge>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              {vpnStatus === "connecting" ? (
                <Button
                  className="w-full"
                  variant="destructive"
                  size="lg"
                  onClick={handleInterrupt}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  中断
                </Button>
              ) : (
                <Button
                  className={`w-full ${connectButtonProps.colorClass}`}
                  variant={connectButtonProps.variant}
                  size="lg"
                  onClick={handleConnectToggle}
                  disabled={isOperationDisabled}
                >
                  {isProcessing ? "処理中..." : connectButtonProps.text}
                </Button>
              )}
              <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full" disabled={isProcessing}>
                    <Settings className="mr-2 h-4 w-4" />
                    設定
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>アプリケーション設定</DialogTitle>
                    <DialogDescription>vpncli.exeのパスを設定します。</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <Label htmlFor="cli-path">vpncli.exe のパス</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="cli-path"
                        value={cliPath}
                        onChange={(e) => setCliPath(e.target.value)}
                        className="flex-grow"
                      />
                      {/* ★ 「検証」ボタンの文字色を黄色に変更 */}
                      <Button onClick={handleValidateCliPath} className="text-yellow-300">
                        検証
                      </Button>
                    </div>
                    {isCliPathValid !== null && (
                      <p
                        className={`text-sm ${isCliPathValid ? "text-green-600" : "text-red-600"}`}
                      >
                        検証結果: パスは{isCliPathValid ? "有効です" : "無効です"}。
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={handleSaveSettings} className="bg-teal-600 hover:bg-teal-700">
                      保存
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>
        </div>
      </div>

      <Dialog open={isConnDialogOpen} onOpenChange={setIsConnDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConn ? "接続情報の編集" : "新しい接続情報の追加"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveConnection} className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                表示名
              </Label>
              <Input
                id="name"
                name="name"
                defaultValue={editingConn?.name ?? ""}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="host" className="text-right">
                ホスト
              </Label>
              <Input
                id="host"
                name="host"
                defaultValue={editingConn?.host ?? ""}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                ユーザー名
              </Label>
              <Input
                id="username"
                name="username"
                defaultValue={editingConn?.username ?? ""}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                パスワード
              </Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder={editingConn ? "変更する場合のみ入力" : ""}
                className="col-span-3"
                required={!editingConn}
              />
            </div>
            <DialogFooter>
              <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="top-right" />
    </div>
  );
}

export default App;
