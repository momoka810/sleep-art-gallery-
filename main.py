"""
Claude APIを使用したサンプルコード
"""
import os
from pathlib import Path
from dotenv import load_dotenv
from anthropic import Anthropic

# .envファイルから環境変数を読み込む（存在する場合）
load_dotenv()

# APIキーを取得
api_key = os.getenv("ANTHROPIC_API_KEY")

# .envファイルにAPIキーがない場合、親ディレクトリのapi_key.txtから読み込む
if not api_key:
    api_key_path = Path(__file__).parent.parent / "api_key.txt"
    if api_key_path.exists():
        with open(api_key_path, "r") as f:
            api_key = f.read().strip()
    else:
        print("エラー: APIキーが見つかりません")
        print("以下のいずれかの方法でAPIキーを設定してください:")
        print("1. .envファイルに ANTHROPIC_API_KEY=your_api_key を追加")
        print("2. 親ディレクトリに api_key.txt ファイルを作成")
        exit(1)

# Anthropicクライアントを初期化
client = Anthropic(api_key=api_key)

def main():
    """メイン関数"""
    print("Claude APIを使用したコード生成ツール")
    print("-" * 50)
    
    # サンプル: 簡単な質問をClaudeに送信
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": "こんにちは！PythonでHello Worldを出力するコードを書いてください。"
            }
        ]
    )
    
    print("Claudeからの応答:")
    print(message.content[0].text)
    print("-" * 50)

if __name__ == "__main__":
    main()

