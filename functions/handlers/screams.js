const { response } = require("express");
const { db } = require("../util/admin");

exports.getAllScreams = (request, response) => {
  db.collection("screams")
    .orderBy("createdAt", "desc")
    .get()
    .then((data) => {
      let screams = [];
      data.forEach((doc) => {
        screams.push({
          screamId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          likeCOunt: doc.data().likeCount,
          commentCount: doc.data().commentCount,
          userImage: doc.data().userImage,
        });
      });
      return response.json(screams);
    })
    .catch((err) => console.error(err));
};

exports.postOneScream = (request, response) => {
  if (request.method !== "POST") {
    return response.status(400).json({ error: "Method not allowed" });
  }
  const newScream = {
    body: request.body.body,
    userHandle: request.user.handle,
    createdAt: new Date().toISOString(),
    userImage: request.user.imageUrl,
    likeCount: 0,
    commentCount: 0,
  };

  db.collection("screams")
    .add(newScream)
    .then((doc) => {
      const resScream = newScream;
      resScream.screamId = doc.id;
      response.json({ resScream });
    })
    .catch((err) => {
      response.status(500).json({ error: "something went wrong" });
      console.error(err);
    });
};

exports.getScream = (request, response) => {
  let screamData = {};
  db.doc(`/screams/${request.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return response.status(404).json({ error: "Scream not found" });
      } else {
        screamData = doc.data();
        screamData.screamId = doc.id;
        return db
          .collection(`comments`)
          .orderBy(`createdAt`, `desc`)
          .where(`screamId`, `==`, request.params.screamId)
          .get();
      }
    })
    .then((data) => {
      screamData.comments = [];
      data.forEach((doc) => {
        screamData.comments.push(doc.data());
      });
      return response.json(screamData);
    })
    .catch((err) => {
      console.error(err);
      response.status(500).json({ error: err.code });
    });
};

exports.commentOnScream = (request, response) => {
  if (request.method !== "POST") {
    return response.status(400).json({ error: "Method not allowed" });
  }

  if (request.body.body === "") {
    return response.status(400).json({ error: "Must not be empty" });
  }

  const newComment = {
    body: request.body.body,
    createdAt: new Date().toISOString(),
    screamId: request.params.screamId,
    userHandle: request.user.handle,
    userImage: request.user.imageUrl,
  };
  db.doc(`/screams/${request.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return response.status(404).json({ error: "scream not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      response.json(newComment);
    })
    .catch((err) => {
      console.error(err);
      response.status(500).json({ error: err.code });
    });
};

exports.likeScream = (request, response) => {
  const screamDocument = db.doc(`/screams/${request.params.screamId}`);
  let screamData;

  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        if (
          screamData !== undefined &&
          !screamData.hasOwnProperty("likeCount")
        ) {
          screamData.likeCount = 0;
        }
        return db
          .collection("likes")
          .where("userHandle", "==", request.user.handle)
          .where("screamId", "==", request.params.screamId)
          .limit(1)
          .get();
      } else {
        return response.status(404).json({ error: "scream not found" });
      }
    })
    .then((doc) => {
      if (doc.exists) {
        return response.status(500).json({ error: "scream already liked" });
      } else {
        db.collection("likes")
          .add({
            screamId: request.params.screamId,
            userHandle: request.user.handle,
          })
          .then(() => {
            screamData.likeCount++;
            return db
              .doc(`/screams/${request.params.screamId}`)
              .update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            return response.json({ message: "successfully liked" });
          });
      }
    })
    .catch((err) => {
      console.error(err);
      response.status(500).json({ error: err.code });
    });
};

exports.unlikeScream = (request, response) => {
  const screamDocument = db.doc(`/screams/${request.params.screamId}`);
  let screamData;

  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        return db
          .collection("likes")
          .where("userHandle", "==", request.user.handle)
          .where("screamId", "==", request.params.screamId)
          .limit(1)
          .get();
      } else {
        return response.status(404).json({ error: "scream not found" });
      }
    })
    .then((doc) => {
      if (doc.empty) {
        return response.status(500).json({ error: "scream not liked" });
      } else {
        db.doc(`/likes/${doc.docs[0].id}`)
          .delete()
          .then(() => {
            screamData.likeCount--;
            return db
              .doc(`/screams/${request.params.screamId}`)
              .update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            return response.json({ message: "successfully unliked" });
          });
      }
    })
    .catch((err) => {
      console.error(err);
      response.status(500).json({ error: err.code });
    });
};

exports.deleteScream = (request, response) => {
  const document = db.doc(`/screams/${request.params.screamId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return response.status(404).json({ error: "scream does not exist" });
      }
      if (doc.data().userHandle !== request.user.handle) {
        return response.status(403).json({ error: "wrong user" });
      }
      document.delete().then(() => {
        return response.json({ message: "document succcessfully deleted" });
      });
    })
    .catch((err) => {
      console.error(err);
      return response.status(500).json({ error: err.code });
    });
};
