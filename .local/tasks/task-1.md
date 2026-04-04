---
title: Sohbet: en son konuşma seç + otomatik kaymayı düzelt
---
# Sohbet: En Son Konuşma + Otomatik Kaymayı Düzelt

## What & Why
İki sorun var:
1. Sohbet açıldığında listedeki ilk kişi seçiliyor, en son mesajlaşılan değil.
2. Her 3 saniyede bir yeni mesaj sorgulandığında ekran otomatik en alta kayıyor — kullanıcı eski mesajlara bakarken çekilip aşağıya düşüyor.

## Done looks like
- Sohbet sekmesi açıldığında en son mesajlaşılan kişinin konuşması otomatik açılır
- Geçmişte hiç mesaj yoksa listedeki ilk kişi seçilir
- Sohbet açıkken ekran yalnızca iki durumda en alta kayar: (a) yeni bir konuşmaya ilk geçişte, (b) kullanıcı mesaj gönderdiğinde
- 3 saniyelik polling güncellemelerinde ekran kayıp etmez; kullanıcı eski mesajlara bakabilir

## Out of scope
- Okunmamış mesaj sayacı eklenmesi
- Sohbet listesinin canlı yeniden sıralanması

## Tasks
1. **Backend — son konuşmalar endpoint'i** — `/api/conversations` GET endpoint'i ekle; mevcut kullanıcının mesajlaştığı kişileri son mesaj tarihine göre sıralı döndürsün.

2. **Frontend — otomatik seçim ve kaymayı düzelt** — ChatInterface'i güncelle: açılışta `/api/conversations` ile en son konuşulan kişiyi `activeUser` olarak seç. Otomatik kaymayı (scrollIntoView) yalnızca yeni konuşma açıldığında veya mesaj gönderildiğinde tetikle; polling güncellemelerinde tetikleme.

## Relevant files
- `client/src/components/ChatInterface.tsx:38-106`
- `server/routes.ts`
- `server/storage.ts`