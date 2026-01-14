/*
Random Legal Chess Move Generator (vanilla JavaScript, browser-friendly, made with GitHub Copilot)
Exports moves in Standard Algebraic Notation (SAN).

Usage:
  // Play 4 full moves (white+black each)
  const result = ChessRandom.generateRandomGame(4);
  console.log(result.moves);     // array of SAN moves like ["e4","c5", "Nf3", "d6", ...]
  console.log(result.finalFEN);  // resulting FEN
  console.log(result.terminated); // null or "checkmate" / "stalemate"
*/

const ChessRandom = (function () {
  const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  // Utilities: square <-> algebraic
  function sqToAlg(r, c) {
    return String.fromCharCode(97 + c) + (8 - r);
  }
  function algToSq(s) {
    const c = s.charCodeAt(0) - 97;
    const r = 8 - parseInt(s[1], 10);
    return [r, c];
  }

  function cloneState(state) {
    return {
      board: state.board.map(row => row.slice()),
      turn: state.turn,
      castling: state.castling,
      enPassant: state.enPassant ? { r: state.enPassant.r, c: state.enPassant.c } : null,
      halfmove: state.halfmove,
      fullmove: state.fullmove,
    };
  }

  function parseFEN(fen) {
    const parts = fen.split(/\s+/);
    if (parts.length < 4) throw new Error("Invalid FEN");
    const rows = parts[0].split("/");
    if (rows.length !== 8) throw new Error("Invalid FEN rows");
    const board = Array.from({ length: 8 }, () => Array(8).fill(null));
    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const ch of rows[r]) {
        if (/[1-8]/.test(ch)) {
          c += parseInt(ch, 10);
        } else {
          board[r][c] = ch;
          c++;
        }
      }
      if (c !== 8) throw new Error("Invalid FEN row length");
    }
    const turn = parts[1];
    const castling = parts[2] === "-" ? "" : parts[2];
    const enp = parts[3] === "-" ? null : (function () {
      const [r, c] = algToSq(parts[3]);
      return { r, c };
    })();
    const halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
    const fullmove = parts[5] ? parseInt(parts[5], 10) : 1;
    return { board, turn, castling, enPassant: enp, halfmove, fullmove };
  }

  function stateToFEN(state) {
    const rows = state.board.map(row => {
      let empty = 0;
      let out = "";
      for (const cell of row) {
        if (!cell) empty++;
        else {
          if (empty) { out += empty; empty = 0; }
          out += cell;
        }
      }
      if (empty) out += empty;
      return out;
    });
    const enp = state.enPassant ? sqToAlg(state.enPassant.r, state.enPassant.c) : "-";
    return `${rows.join("/") } ${state.turn} ${state.castling || "-"} ${enp} ${state.halfmove} ${state.fullmove}`;
  }

  const inBounds = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const isWhite = p => p && p === p.toUpperCase();
  const isBlack = p => p && p === p.toLowerCase();

  const knightOffsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const kingOffsets = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const rookDirs = [[-1,0],[1,0],[0,-1],[0,1]];
  const bishopDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];

  function isSquareAttacked(state, r, c, byColor) {
    const board = state.board;
    const attackersAreWhite = byColor === 'w';

    // Pawn attacks
    if (attackersAreWhite) {
      for (const dc of [-1, 1]) {
        const rr = r + 1, cc = c + dc;
        if (inBounds(rr, cc) && board[rr][cc] === 'P') return true;
      }
    } else {
      for (const dc of [-1, 1]) {
        const rr = r - 1, cc = c + dc;
        if (inBounds(rr, cc) && board[rr][cc] === 'p') return true;
      }
    }

    // Knights
    for (const [dr, dc] of knightOffsets) {
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc)) {
        const piece = board[rr][cc];
        if (piece && ((attackersAreWhite && piece === 'N') || (!attackersAreWhite && piece === 'n'))) return true;
      }
    }

    // Rooks & Queens (orthogonal)
    for (const [dr, dc] of rookDirs) {
      let rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p) {
          if (attackersAreWhite && (p === 'R' || p === 'Q')) return true;
          if (!attackersAreWhite && (p === 'r' || p === 'q')) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }

    // Bishops & Queens (diagonal)
    for (const [dr, dc] of bishopDirs) {
      let rr = r + dr, cc = c + dc;
      while (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p) {
          if (attackersAreWhite && (p === 'B' || p === 'Q')) return true;
          if (!attackersAreWhite && (p === 'b' || p === 'q')) return true;
          break;
        }
        rr += dr; cc += dc;
      }
    }

    // King
    for (const [dr, dc] of kingOffsets) {
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc)) {
        const p = board[rr][cc];
        if (p && ((attackersAreWhite && p === 'K') || (!attackersAreWhite && p === 'k'))) return true;
      }
    }

    return false;
  }

  function findKing(state, color) {
    const target = color === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (state.board[r][c] === target) return [r, c];
    return null;
  }

  function makeMove(state, move) {
    const ns = cloneState(state);
    const { from, to } = move;
    const piece = ns.board[from.r][from.c];
    ns.board[to.r][to.c] = piece;
    ns.board[from.r][from.c] = null;

    if (move.isEnPassant) {
      const capR = state.turn === 'w' ? to.r + 1 : to.r - 1;
      ns.board[capR][to.c] = null;
    }
    if (move.promotion) {
      ns.board[to.r][to.c] = (state.turn === 'w') ? move.promotion.toUpperCase() : move.promotion.toLowerCase();
    }
    if (move.isCastle) {
      if (to.c === 6) {
        const rr = to.r;
        ns.board[rr][5] = ns.board[rr][7];
        ns.board[rr][7] = null;
      } else if (to.c === 2) {
        const rr = to.r;
        ns.board[rr][3] = ns.board[rr][0];
        ns.board[rr][0] = null;
      }
    }

    let castling = ns.castling;
    if (piece === 'K') castling = castling.replace(/K|Q/g, '');
    if (piece === 'k') castling = castling.replace(/k|q/g, '');
    if (from.r === 7 && from.c === 0) castling = castling.replace(/Q/g, '');
    if (from.r === 7 && from.c === 7) castling = castling.replace(/K/g, '');
    if (from.r === 0 && from.c === 0) castling = castling.replace(/q/g, '');
    if (from.r === 0 && from.c === 7) castling = castling.replace(/k/g, '');
    if (move.capturedSquare) {
      const cr = move.capturedSquare;
      if (cr.r === 7 && cr.c === 0) castling = castling.replace(/Q/g, '');
      if (cr.r === 7 && cr.c === 7) castling = castling.replace(/K/g, '');
      if (cr.r === 0 && cr.c === 0) castling = castling.replace(/q/g, '');
      if (cr.r === 0 && cr.c === 7) castling = castling.replace(/k/g, '');
    }
    ns.castling = castling;

    ns.enPassant = null;
    if ((piece === 'P' && from.r === 6 && to.r === 4) || (piece === 'p' && from.r === 1 && to.r === 3)) {
      ns.enPassant = { r: (from.r + to.r) / 2, c: from.c };
    }

    if (piece.toLowerCase() === 'p' || move.capturedSquare) ns.halfmove = 0;
    else ns.halfmove++;

    ns.turn = ns.turn === 'w' ? 'b' : 'w';
    if (ns.turn === 'w') ns.fullmove++;

    return ns;
  }

  function generateLegalMoves(state) {
    const color = state.turn;
    const board = state.board;
    const myIsWhite = color === 'w';
    const moves = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        if (myIsWhite && !isWhite(p)) continue;
        if (!myIsWhite && !isBlack(p)) continue;

        const from = { r, c };
        const pieceType = p.toLowerCase();

        if (pieceType === 'p') {
          const dir = myIsWhite ? -1 : 1;
          const startRank = myIsWhite ? 6 : 1;
          const promoteRank = myIsWhite ? 0 : 7;

          const r1 = r + dir;
          if (inBounds(r1, c) && !board[r1][c]) {
            if (r1 === promoteRank) {
              for (const promo of ['q','r','b','n']) {
                moves.push({ from, to: { r: r1, c }, piece: p, promotion: promo });
              }
            } else {
              moves.push({ from, to: { r: r1, c }, piece: p });
            }
            const r2 = r + 2*dir;
            if (r === startRank && inBounds(r2, c) && !board[r2][c]) {
              moves.push({ from, to: { r: r2, c }, piece: p });
            }
          }
          for (const dc of [-1, 1]) {
            const rr = r + dir, cc = c + dc;
            if (!inBounds(rr, cc)) continue;
            const target = board[rr][cc];
            if (target && ((myIsWhite && isBlack(target)) || (!myIsWhite && isWhite(target)))) {
              if (rr === promoteRank) {
                for (const promo of ['q','r','b','n']) {
                  moves.push({ from, to: { r: rr, c: cc }, piece: p, promotion: promo, capturedSquare: { r: rr, c: cc } });
                }
              } else {
                moves.push({ from, to: { r: rr, c: cc }, piece: p, capturedSquare: { r: rr, c: cc } });
              }
            }
          }
          if (state.enPassant) {
            for (const dc of [-1, 1]) {
              const cc = c + dc;
              const rr = r + dir;
              if (inBounds(rr, cc) && rr === state.enPassant.r && cc === state.enPassant.c) {
                moves.push({ from, to: { r: rr, c: cc }, piece: p, isEnPassant: true, capturedSquare: { r: r, c: cc } });
              }
            }
          }
        } else if (pieceType === 'n') {
          for (const [dr, dc] of knightOffsets) {
            const rr = r + dr, cc = c + dc;
            if (!inBounds(rr, cc)) continue;
            const target = board[rr][cc];
            if (!target || (myIsWhite ? isBlack(target) : isWhite(target))) {
              if (target) moves.push({ from, to: { r: rr, c: cc }, piece: p, capturedSquare: { r: rr, c: cc } });
              else moves.push({ from, to: { r: rr, c: cc }, piece: p });
            }
          }
        } else if (pieceType === 'b' || pieceType === 'r' || pieceType === 'q') {
          const dirs = pieceType === 'b' ? bishopDirs : pieceType === 'r' ? rookDirs : rookDirs.concat(bishopDirs);
          for (const [dr, dc] of dirs) {
            let rr = r + dr, cc = c + dc;
            while (inBounds(rr, cc)) {
              const target = board[rr][cc];
              if (!target) {
                moves.push({ from, to: { r: rr, c: cc }, piece: p });
              } else {
                if (myIsWhite ? isBlack(target) : isWhite(target)) {
                  moves.push({ from, to: { r: rr, c: cc }, piece: p, capturedSquare: { r: rr, c: cc } });
                }
                break;
              }
              rr += dr; cc += dc;
            }
          }
        } else if (pieceType === 'k') {
          for (const [dr, dc] of kingOffsets) {
            const rr = r + dr, cc = c + dc;
            if (!inBounds(rr, cc)) continue;
            const target = board[rr][cc];
            if (!target || (myIsWhite ? isBlack(target) : isWhite(target))) {
              if (target) moves.push({ from, to: { r: rr, c: cc }, piece: p, capturedSquare: { r: rr, c: cc } });
              else moves.push({ from, to: { r: rr, c: cc }, piece: p });
            }
          }
          if (myIsWhite) {
            if (r === 7 && c === 4) {
              if (state.castling.includes('K')) {
                if (!board[7][5] && !board[7][6]) {
                  if (!isSquareAttacked(state, 7, 4, 'b') && !isSquareAttacked(state, 7,5,'b') && !isSquareAttacked(state,7,6,'b')) {
                    moves.push({ from, to: { r: 7, c: 6 }, piece: p, isCastle: true });
                  }
                }
              }
              if (state.castling.includes('Q')) {
                if (!board[7][3] && !board[7][2] && !board[7][1]) {
                  if (!isSquareAttacked(state, 7,4,'b') && !isSquareAttacked(state,7,3,'b') && !isSquareAttacked(state,7,2,'b')) {
                    moves.push({ from, to: { r: 7, c: 2 }, piece: p, isCastle: true });
                  }
                }
              }
            }
          } else {
            if (r === 0 && c === 4) {
              if (state.castling.includes('k')) {
                if (!board[0][5] && !board[0][6]) {
                  if (!isSquareAttacked(state, 0,4,'w') && !isSquareAttacked(state,0,5,'w') && !isSquareAttacked(state,0,6,'w')) {
                    moves.push({ from, to: { r: 0, c: 6 }, piece: p, isCastle: true });
                  }
                }
              }
              if (state.castling.includes('q')) {
                if (!board[0][3] && !board[0][2] && !board[0][1]) {
                  if (!isSquareAttacked(state,0,4,'w') && !isSquareAttacked(state,0,3,'w') && !isSquareAttacked(state,0,2,'w')) {
                    moves.push({ from, to: { r: 0, c: 2 }, piece: p, isCastle: true });
                  }
                }
              }
            }
          }
        }
      }
    }

    const legalMoves = [];
    for (const mv of moves) {
      const trial = makeMove(state, mv);
      const movingColor = state.turn;
      const kingPos = findKing(trial, movingColor);
      if (!kingPos) continue;
      const inCheck = isSquareAttacked(trial, kingPos[0], kingPos[1], movingColor === 'w' ? 'b' : 'w');
      if (!inCheck) legalMoves.push(mv);
    }

    return legalMoves;
  }

  function isInCheck(state, color) {
    const kingPos = findKing(state, color);
    if (!kingPos) return false;
    return isSquareAttacked(state, kingPos[0], kingPos[1], color === 'w' ? 'b' : 'w');
  }

  // Return SAN for a single move given current state (before move)
  function moveToSAN(state, move) {
    const piece = state.board[move.from.r][move.from.c];
    const pieceType = piece.toUpperCase();
    const isPawn = pieceType === 'P';
    const opponent = state.turn === 'w' ? 'b' : 'w';

    // Castling
    if (move.isCastle) {
      const san = (move.to.c === 6) ? 'O-O' : 'O-O-O';
      const trial = makeMove(state, move);
      const opponentMoves = generateLegalMoves(trial);
      if (opponentMoves.length === 0 && isInCheck(trial, opponent)) return san + '#';
      if (isInCheck(trial, opponent)) return san + '+';
      return san;
    }

    // Destination square
    const dest = sqToAlg(move.to.r, move.to.c);

    // Determine if capture
    const isCapture = !!(move.capturedSquare || move.isEnPassant);

    // Pawn moves
    if (isPawn) {
      let san = '';
      if (isCapture) {
        san += String.fromCharCode(97 + move.from.c) + 'x' + dest;
      } else {
        san += dest;
      }
      if (move.promotion) {
        san += '=' + move.promotion.toUpperCase();
      }
      // check/mate suffix
      const trial = makeMove(state, move);
      const oppMoves = generateLegalMoves(trial);
      if (oppMoves.length === 0 && isInCheck(trial, opponent)) return san + '#';
      if (isInCheck(trial, opponent)) return san + '+';
      return san;
    }

    // Piece moves (N, B, R, Q, K)
    // Determine disambiguation if necessary
    const allMoves = generateLegalMoves(state);
    const samePieceMoves = allMoves.filter(mv => {
      const mvPiece = state.board[mv.from.r][mv.from.c];
      return mv.to.r === move.to.r && mv.to.c === move.to.c && mvPiece && mvPiece.toUpperCase() === pieceType;
    });

    let disambiguation = '';
    if (samePieceMoves.length > 1) {
      // Check if file disambiguates
      const sameFile = samePieceMoves.filter(mv => mv.from.c === move.from.c).length === 1;
      const sameRank = samePieceMoves.filter(mv => mv.from.r === move.from.r).length === 1;
      if (!samePieceMoves.some(mv => mv.from.c === move.from.c && (mv.from.r !== move.from.r))) {
        // file unique
      }
      // According to SAN rules: if file is unique among movers -> use file; else if rank unique -> use rank; else file+rank
      const fileUnique = samePieceMoves.every(mv => mv.from.c === move.from.c ? true : mv.from.c !== move.from.c) &&
                         (samePieceMoves.filter(mv => mv.from.c === move.from.c).length === 1);
      // Simpler reliable approach:
      const fileCollision = samePieceMoves.some(mv => mv !== move && mv.from.c === move.from.c);
      const rankCollision = samePieceMoves.some(mv => mv !== move && mv.from.r === move.from.r);

      if (!fileCollision) {
        disambiguation = String.fromCharCode(97 + move.from.c); // file letter
      } else if (!rankCollision) {
        disambiguation = String(8 - move.from.r); // rank number
      } else {
        disambiguation = String.fromCharCode(97 + move.from.c) + String(8 - move.from.r);
      }
    }

    let san = pieceType + disambiguation + (isCapture ? 'x' : '') + dest;
    if (move.promotion) {
      san += '=' + move.promotion.toUpperCase();
    }

    const trial = makeMove(state, move);
    const oppMoves = generateLegalMoves(trial);
    if (oppMoves.length === 0 && isInCheck(trial, opponent)) return san + '#';
    if (isInCheck(trial, opponent)) return san + '+';
    return san;
  }

  // Play random legal moves up to fullMoves (1..10). Returns {moves: [SAN...], finalFEN, terminated}
  function generateRandomGame(fullMoves = 4) {
    fullMoves = Math.max(1, Math.min(10, Math.floor(fullMoves) || 1));
    let state = parseFEN(STARTING_FEN);
    const movesList = [];
    let terminated = null;

    for (let mv = 0; mv < fullMoves; mv++) {
      // White move
      const whiteMoves = generateLegalMoves(state);
      if (whiteMoves.length === 0) {
        terminated = isInCheck(state, 'w') ? 'checkmate' : 'stalemate';
        break;
      }
      const chosenW = whiteMoves[Math.floor(Math.random() * whiteMoves.length)];
      movesList.push(moveToSAN(state, chosenW));
      state = makeMove(state, chosenW);

      const blackMovesAfterW = generateLegalMoves(state);
      if (blackMovesAfterW.length === 0) {
        terminated = isInCheck(state, 'b') ? 'checkmate' : 'stalemate';
        break;
      }

      // Black move
      const blackMoves = blackMovesAfterW;
      const chosenB = blackMoves[Math.floor(Math.random() * blackMoves.length)];
      movesList.push(moveToSAN(state, chosenB));
      state = makeMove(state, chosenB);

      const whiteMovesAfterB = generateLegalMoves(state);
      if (whiteMovesAfterB.length === 0) {
        terminated = isInCheck(state, 'w') ? 'checkmate' : 'stalemate';
        break;
      }
    }

    return { moves: movesList, finalFEN: stateToFEN(state), terminated };
  }

  return {
    parseFEN,
    stateToFEN,
    generateLegalMoves,
    generateRandomGame,
    moveToSAN,
    isInCheck,
    STARTING_FEN,
  };
})();

if (typeof window !== 'undefined') window.ChessRandom = ChessRandom;
